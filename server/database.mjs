import { mkdirSync } from "node:fs";
import path from "node:path";

import { DataTypes, Sequelize } from "sequelize";
import pg from "pg";

const DEFAULT_DATABASE_PATH = path.join(process.cwd(), "data", "stockflow.sqlite");

function ensureStorageDirectory(storage) {
  if (!storage || storage === ":memory:") return;
  mkdirSync(path.dirname(path.resolve(storage)), { recursive: true });
}

function defineModels(sequelize) {
  const Organization = sequelize.define(
    "Organization",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      defaultLowStockThreshold: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
        field: "default_low_stock_threshold",
        validate: { min: 0, max: 1_000_000_000 },
      },
    },
    {
      tableName: "organizations",
      underscored: true,
      timestamps: true,
    },
  );

  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: "users_organization_unique",
        field: "organization_id",
      },
      email: {
        type: DataTypes.STRING(254),
        allowNull: false,
        unique: "users_email_unique",
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "password_hash",
      },
    },
    {
      tableName: "users",
      underscored: true,
      timestamps: true,
    },
  );

  const Session = sequelize.define(
    "Session",
    {
      id: {
        type: DataTypes.STRING(64),
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "user_id",
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "expires_at",
      },
    },
    {
      tableName: "sessions",
      underscored: true,
      timestamps: true,
      indexes: [
        { name: "sessions_user_idx", fields: ["user_id"] },
        { name: "sessions_expiry_idx", fields: ["expires_at"] },
      ],
    },
  );

  const Product = sequelize.define(
    "Product",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "organization_id",
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      quantityOnHand: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "quantity_on_hand",
        validate: { min: 0, max: 1_000_000_000 },
      },
      costPriceCents: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: "cost_price_cents",
      },
      sellingPriceCents: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: "selling_price_cents",
      },
      lowStockThreshold: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "low_stock_threshold",
        validate: { min: 0, max: 1_000_000_000 },
      },
      lastUpdatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "last_updated_by",
      },
    },
    {
      tableName: "products",
      underscored: true,
      timestamps: true,
      indexes: [
        {
          name: "products_organization_sku_unique",
          unique: true,
          fields: ["organization_id", "sku"],
        },
        { name: "products_organization_idx", fields: ["organization_id"] },
        {
          name: "products_org_updated_idx",
          fields: ["organization_id", "updated_at"],
        },
      ],
    },
  );

  Organization.hasOne(User, {
    as: "owner",
    foreignKey: "organizationId",
    onDelete: "CASCADE",
  });
  User.belongsTo(Organization, {
    as: "organization",
    foreignKey: "organizationId",
    onDelete: "CASCADE",
  });

  Organization.hasMany(Product, {
    as: "products",
    foreignKey: "organizationId",
    onDelete: "CASCADE",
  });
  Product.belongsTo(Organization, {
    as: "organization",
    foreignKey: "organizationId",
    onDelete: "CASCADE",
  });

  User.hasMany(Session, {
    as: "sessions",
    foreignKey: "userId",
    onDelete: "CASCADE",
  });
  Session.belongsTo(User, {
    as: "user",
    foreignKey: "userId",
    onDelete: "CASCADE",
  });

  User.hasMany(Product, {
    as: "updatedProducts",
    foreignKey: "lastUpdatedBy",
    constraints: false,
  });
  Product.belongsTo(User, {
    as: "lastUpdater",
    foreignKey: "lastUpdatedBy",
    constraints: false,
  });

  return { Organization, User, Session, Product };
}

export function createDatabase({
  storage = process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH,
  logging = false,
} = {}) {
  const connectionString = process.env.DATABASE_URL;
  let sequelize;

  if (connectionString) {
    const databaseUrl = new URL(connectionString);
    if (databaseUrl.searchParams.get("sslmode") === "require") {
      databaseUrl.searchParams.set("sslmode", "verify-full");
    }
    sequelize = new Sequelize(databaseUrl.toString(), {
      dialect: "postgres",
      dialectModule: pg,
      logging,
      define: { freezeTableName: true },
      pool: { max: 5, min: 0, idle: 10_000, acquire: 30_000 },
    });
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production.");
    }
    ensureStorageDirectory(storage);
    sequelize = new Sequelize({
      dialect: "sqlite",
      storage,
      logging,
      define: { freezeTableName: true },
      pool: { max: 1, min: 0, idle: 10_000 },
    });
  }

  return {
    sequelize,
    storage: connectionString ? null : storage,
    ...defineModels(sequelize),
  };
}

export const database = createDatabase();

const initializationPromises = new WeakMap();

export async function initializeDatabase(target = database, syncOptions = {}) {
  let initialization = initializationPromises.get(target);
  if (!initialization) {
    initialization = (async () => {
      await target.sequelize.authenticate();
      if (target.sequelize.getDialect() === "sqlite") {
        await target.sequelize.query("PRAGMA foreign_keys = ON");
        await target.sequelize.query("PRAGMA busy_timeout = 5000");
        if (target.storage !== ":memory:") {
          await target.sequelize.query("PRAGMA journal_mode = WAL");
        }
      }
      await target.sequelize.sync(syncOptions);
      return target;
    })();
    initializationPromises.set(target, initialization);
  }

  try {
    return await initialization;
  } catch (error) {
    initializationPromises.delete(target);
    throw error;
  }
}

export async function closeDatabase(target = database) {
  await target.sequelize.close();
}
