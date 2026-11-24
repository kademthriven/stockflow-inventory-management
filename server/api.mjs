import express from "express";
import bcrypt from "bcrypt";
import { Op, UniqueConstraintError, ValidationError } from "sequelize";

import { createAuth } from "./auth.mjs";
import {
  database as defaultDatabase,
  initializeDatabase,
} from "./database.mjs";
import {
  parseDefaultThreshold,
  parseLogin,
  parseProductMutation,
  parseSignup,
  RequestValidationError,
} from "./validation.mjs";

const BCRYPT_ROUNDS = 12;

function amountFromCents(value) {
  if (value === null || value === undefined) return null;
  return Number(value) / 100;
}

function serializeProduct(product, defaultLowStockThreshold) {
  const plain = product.get ? product.get({ plain: true }) : product;
  const effectiveLowStockThreshold =
    plain.lowStockThreshold ?? defaultLowStockThreshold;

  return {
    id: plain.id,
    name: plain.name,
    sku: plain.sku,
    description: plain.description ?? null,
    quantityOnHand: plain.quantityOnHand,
    costPrice: amountFromCents(plain.costPriceCents),
    sellingPrice: amountFromCents(plain.sellingPriceCents),
    lowStockThreshold: plain.lowStockThreshold ?? null,
    effectiveLowStockThreshold,
    isLowStock: plain.quantityOnHand <= effectiveLowStockThreshold,
    createdAt: new Date(plain.createdAt).toISOString(),
    updatedAt: new Date(plain.updatedAt).toISOString(),
  };
}

function isProductSkuConstraint(error) {
  if (!(error instanceof UniqueConstraintError)) return false;
  const fields = Object.keys(error.fields ?? {}).join(" ").toLowerCase();
  const message = `${error.message} ${error.parent?.message ?? ""}`.toLowerCase();
  return (
    fields.includes("sku") ||
    message.includes("products_organization_sku_unique") ||
    message.includes("products.organization_id, products.sku")
  );
}

function validationResponse(error, response) {
  const entries = Object.entries(error.fields ?? {});
  if (entries.length === 1 && entries[0][0] !== "form") {
    response.status(400).json({ error: entries[0][1], field: entries[0][0] });
    return;
  }
  response.status(400).json({ error: error.message, fields: error.fields });
}

export function createApiRouter({ database = defaultDatabase } = {}) {
  const router = express.Router();
  const { Organization, Product, User, sequelize } = database;
  const auth = createAuth(database);

  router.post("/auth/signup", async (request, response, next) => {
    try {
      const input = parseSignup(request.body);
      const existingUser = await User.findOne({ where: { email: input.email } });
      if (existingUser) {
        response.status(409).json({
          error: "An account already exists for this email",
          field: "email",
        });
        return;
      }

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      let organization;
      let user;

      await sequelize.transaction(async (transaction) => {
        organization = await Organization.create(
          {
            name: input.organizationName,
            defaultLowStockThreshold: 5,
          },
          { transaction },
        );
        user = await User.create(
          {
            organizationId: organization.id,
            email: input.email,
            passwordHash,
          },
          { transaction },
        );
      });

      await auth.createSession(user.id, response);
      response.status(201).json({
        user: { id: user.id, email: user.email },
        organization: {
          id: organization.id,
          name: organization.name,
          defaultLowStockThreshold: organization.defaultLowStockThreshold,
        },
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        response.status(409).json({
          error: "An account already exists for this email",
          field: "email",
        });
        return;
      }
      next(error);
    }
  });

  router.post("/auth/login", async (request, response, next) => {
    try {
      const input = parseLogin(request.body);
      const user = await User.findOne({
        where: { email: input.email },
        include: [{ model: Organization, as: "organization", required: true }],
      });

      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        response.status(401).json({ error: "Email or password is incorrect" });
        return;
      }

      await auth.destroySession(request, response);
      await auth.createSession(user.id, response);
      response.json({
        user: { id: user.id, email: user.email },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          defaultLowStockThreshold:
            user.organization.defaultLowStockThreshold,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  async function logout(request, response, next) {
    try {
      await auth.destroySession(request, response);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  router.post("/auth/logout", logout);
  router.delete("/auth/logout", logout);

  router.get("/auth/me", async (request, response, next) => {
    try {
      const user = await auth.getCurrentUser(request);
      if (!user) {
        response.status(401).json({ error: "Authentication required" });
        return;
      }
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.get("/products", auth.requireAuth, async (request, response, next) => {
    try {
      const search =
        typeof request.query.search === "string"
          ? request.query.search.trim().slice(0, 120)
          : "";
      const where = { organizationId: request.currentUser.organizationId };
      if (search) {
        const searchOperator =
          sequelize.getDialect() === "postgres" ? Op.iLike : Op.like;
        where[Op.or] = [
          { name: { [searchOperator]: `%${search}%` } },
          { sku: { [Op.like]: `%${search.toUpperCase()}%` } },
        ];
      }

      const products = await Product.findAll({
        where,
        order: [
          ["name", "ASC"],
          ["sku", "ASC"],
        ],
        limit: 500,
      });

      response.json({
        products: products.map((product) =>
          serializeProduct(
            product,
            request.currentUser.defaultLowStockThreshold,
          ),
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/products", auth.requireAuth, async (request, response, next) => {
    try {
      const input = parseProductMutation(request.body, "create");
      const product = await Product.create({
        organizationId: request.currentUser.organizationId,
        name: input.name,
        sku: input.sku,
        description: input.description ?? null,
        quantityOnHand: input.quantityOnHand,
        costPriceCents: input.costPriceCents ?? null,
        sellingPriceCents: input.sellingPriceCents ?? null,
        lowStockThreshold: input.lowStockThreshold ?? null,
        lastUpdatedBy: request.currentUser.id,
      });

      response.status(201).json({
        product: serializeProduct(
          product,
          request.currentUser.defaultLowStockThreshold,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/products/:id", auth.requireAuth, async (request, response, next) => {
    try {
      const product = await Product.findOne({
        where: {
          id: request.params.id,
          organizationId: request.currentUser.organizationId,
        },
      });
      if (!product) {
        response.status(404).json({ error: "Product not found." });
        return;
      }
      response.json({
        product: serializeProduct(
          product,
          request.currentUser.defaultLowStockThreshold,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/products/:id", auth.requireAuth, async (request, response, next) => {
    try {
      const input = parseProductMutation(request.body, "update");
      const product = await Product.findOne({
        where: {
          id: request.params.id,
          organizationId: request.currentUser.organizationId,
        },
      });
      if (!product) {
        response.status(404).json({ error: "Product not found." });
        return;
      }

      await product.update({
        ...input,
        lastUpdatedBy: request.currentUser.id,
      });
      response.json({
        product: serializeProduct(
          product,
          request.currentUser.defaultLowStockThreshold,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/products/:id", auth.requireAuth, async (request, response, next) => {
    try {
      const product = await Product.findOne({
        where: {
          id: request.params.id,
          organizationId: request.currentUser.organizationId,
        },
      });
      if (!product) {
        response.status(404).json({ error: "Product not found." });
        return;
      }
      const id = product.id;
      await product.destroy();
      response.json({ success: true, id });
    } catch (error) {
      next(error);
    }
  });

  router.get("/dashboard", auth.requireAuth, async (request, response, next) => {
    try {
      const organization = await Organization.findByPk(
        request.currentUser.organizationId,
      );
      if (!organization) {
        response.status(404).json({ error: "Organization not found." });
        return;
      }
      const products = await Product.findAll({
        where: { organizationId: organization.id },
        order: [
          ["name", "ASC"],
          ["sku", "ASC"],
        ],
      });
      const serializedProducts = products.map((product) =>
        serializeProduct(product, organization.defaultLowStockThreshold),
      );

      response.json({
        organization: {
          id: organization.id,
          name: organization.name,
          defaultLowStockThreshold:
            organization.defaultLowStockThreshold,
        },
        totalProducts: serializedProducts.length,
        totalUnits: serializedProducts.reduce(
          (sum, product) => sum + product.quantityOnHand,
          0,
        ),
        lowStockItems: serializedProducts.filter(
          (product) => product.isLowStock,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/settings", auth.requireAuth, async (request, response, next) => {
    try {
      const organization = await Organization.findByPk(
        request.currentUser.organizationId,
      );
      if (!organization) {
        response.status(404).json({ error: "Organization not found." });
        return;
      }
      response.json({
        organizationName: organization.name,
        defaultLowStockThreshold: organization.defaultLowStockThreshold,
        updatedAt: organization.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/settings", auth.requireAuth, async (request, response, next) => {
    try {
      const defaultLowStockThreshold = parseDefaultThreshold(request.body);
      const organization = await Organization.findByPk(
        request.currentUser.organizationId,
      );
      if (!organization) {
        response.status(404).json({ error: "Organization not found." });
        return;
      }
      await organization.update({ defaultLowStockThreshold });
      response.json({
        organizationName: organization.name,
        defaultLowStockThreshold: organization.defaultLowStockThreshold,
        updatedAt: organization.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  router.use((request, response) => {
    response.status(404).json({ error: "API route not found." });
  });

  router.use((error, request, response, next) => {
    if (error instanceof RequestValidationError) {
      validationResponse(error, response);
      return;
    }
    if (isProductSkuConstraint(error)) {
      response.status(409).json({
        error: "A product with this SKU already exists in your organization.",
        fields: { sku: "SKU must be unique within your organization." },
      });
      return;
    }
    if (error instanceof ValidationError) {
      response.status(400).json({ error: "The submitted data is invalid." });
      return;
    }
    next(error);
  });

  return router;
}

export function createApiApp({ database = defaultDatabase } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "256kb" }));
  app.use(async (request, response, next) => {
    try {
      await initializeDatabase(database);
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use("/api", createApiRouter({ database }));

  app.use((error, request, response, next) => {
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
      response.status(400).json({ error: "Invalid request body" });
      return;
    }
    console.error("StockFlow server error", error);
    response.status(500).json({ error: "Something went wrong. Please try again." });
  });

  return app;
}
