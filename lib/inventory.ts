import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { organizations, products } from "@/db/schema";

const MAX_QUANTITY = 1_000_000_000;
const MAX_PRICE_CENTS = 10_000_000_000;

export class InventoryValidationError extends Error {
  readonly fields: Record<string, string>;

  constructor(fields: Record<string, string>) {
    super("Please review the highlighted fields.");
    this.name = "InventoryValidationError";
    this.fields = fields;
  }
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new InventoryValidationError({
      form: "Request body must contain valid JSON.",
    });
  }
}

export type ProductRecord = typeof products.$inferSelect;

export type ProductMutation = {
  name?: string;
  sku?: string;
  description?: string | null;
  quantityOnHand?: number;
  costPriceCents?: number | null;
  sellingPriceCents?: number | null;
  lowStockThreshold?: number | null;
};

export type ProductDto = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  quantityOnHand: number;
  costPrice: number | null;
  sellingPrice: number | null;
  lowStockThreshold: number | null;
  effectiveLowStockThreshold: number;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequiredText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
  errors: Record<string, string>,
) {
  if (typeof value !== "string" || !value.trim()) {
    errors[field] = `${label} is required.`;
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    errors[field] = `${label} must be ${maxLength} characters or fewer.`;
    return undefined;
  }

  return normalized;
}

function parseOptionalText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
  errors: Record<string, string>,
) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    errors[field] = `${label} must be text.`;
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    errors[field] = `${label} must be ${maxLength} characters or fewer.`;
    return undefined;
  }

  return normalized;
}

function parseNonNegativeInteger(
  value: unknown,
  field: string,
  label: string,
  errors: Record<string, string>,
) {
  if (value === "" || value === null || value === undefined) {
    errors[field] = `${label} is required.`;
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_QUANTITY) {
    errors[field] = `${label} must be a whole number between 0 and ${MAX_QUANTITY.toLocaleString("en-US")}.`;
    return undefined;
  }

  return parsed;
}

function parseOptionalNonNegativeInteger(
  value: unknown,
  field: string,
  label: string,
  errors: Record<string, string>,
) {
  if (value === "" || value === null || value === undefined) return null;
  return parseNonNegativeInteger(value, field, label, errors);
}

function parseOptionalPrice(
  value: unknown,
  field: string,
  label: string,
  errors: Record<string, string>,
) {
  if (value === "" || value === null || value === undefined) return null;

  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(raw.trim())) {
    errors[field] = `${label} must be a non-negative amount with up to two decimal places.`;
    return undefined;
  }

  const cents = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_PRICE_CENTS) {
    errors[field] = `${label} is outside the supported range.`;
    return undefined;
  }

  return cents;
}

export function parseProductMutation(
  payload: unknown,
  mode: "create" | "update",
): ProductMutation {
  if (!isRecord(payload)) {
    throw new InventoryValidationError({ form: "A JSON object is required." });
  }

  const errors: Record<string, string> = {};
  const mutation: ProductMutation = {};
  const isCreate = mode === "create";

  if (isCreate || Object.hasOwn(payload, "name")) {
    mutation.name = parseRequiredText(payload.name, "name", "Product name", 120, errors);
  }

  if (isCreate || Object.hasOwn(payload, "sku")) {
    const sku = parseRequiredText(payload.sku, "sku", "SKU", 64, errors);
    mutation.sku = sku?.toUpperCase();
  }

  if (isCreate || Object.hasOwn(payload, "description")) {
    mutation.description = parseOptionalText(
      payload.description,
      "description",
      "Description",
      1_000,
      errors,
    );
  }

  if (isCreate || Object.hasOwn(payload, "quantityOnHand")) {
    const value =
      isCreate && !Object.hasOwn(payload, "quantityOnHand")
        ? 0
        : payload.quantityOnHand;
    mutation.quantityOnHand = parseNonNegativeInteger(
      value,
      "quantityOnHand",
      "Quantity on hand",
      errors,
    );
  }

  if (isCreate || Object.hasOwn(payload, "costPrice")) {
    mutation.costPriceCents = parseOptionalPrice(
      payload.costPrice,
      "costPrice",
      "Cost price",
      errors,
    );
  }

  if (isCreate || Object.hasOwn(payload, "sellingPrice")) {
    mutation.sellingPriceCents = parseOptionalPrice(
      payload.sellingPrice,
      "sellingPrice",
      "Selling price",
      errors,
    );
  }

  if (isCreate || Object.hasOwn(payload, "lowStockThreshold")) {
    mutation.lowStockThreshold = parseOptionalNonNegativeInteger(
      payload.lowStockThreshold,
      "lowStockThreshold",
      "Low-stock threshold",
      errors,
    );
  }

  if (mode === "update" && Object.keys(mutation).length === 0) {
    errors.form = "Provide at least one product field to update.";
  }

  if (Object.keys(errors).length > 0) {
    throw new InventoryValidationError(errors);
  }

  return mutation;
}

export function parseDefaultThreshold(payload: unknown) {
  if (!isRecord(payload)) {
    throw new InventoryValidationError({ form: "A JSON object is required." });
  }

  const errors: Record<string, string> = {};
  const threshold = parseNonNegativeInteger(
    payload.defaultLowStockThreshold,
    "defaultLowStockThreshold",
    "Default low-stock threshold",
    errors,
  );

  if (Object.keys(errors).length > 0 || threshold === undefined) {
    throw new InventoryValidationError(errors);
  }

  return threshold;
}

function centsToAmount(value: number | null) {
  return value === null ? null : value / 100;
}

export function serializeProduct(
  product: ProductRecord,
  defaultLowStockThreshold: number,
): ProductDto {
  const effectiveLowStockThreshold =
    product.lowStockThreshold ?? defaultLowStockThreshold;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    quantityOnHand: product.quantityOnHand,
    costPrice: centsToAmount(product.costPriceCents),
    sellingPrice: centsToAmount(product.sellingPriceCents),
    lowStockThreshold: product.lowStockThreshold,
    effectiveLowStockThreshold,
    isLowStock: product.quantityOnHand <= effectiveLowStockThreshold,
    createdAt: new Date(product.createdAt).toISOString(),
    updatedAt: new Date(product.updatedAt).toISOString(),
  };
}

export async function getOrganizationSettings(organizationId: string) {
  const db = getDb();
  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      defaultLowStockThreshold: organizations.defaultLowStockThreshold,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return organization ?? null;
}

export async function getInventorySnapshot(organizationId: string) {
  const db = getDb();
  const [organization, records] = await Promise.all([
    getOrganizationSettings(organizationId),
    db
      .select()
      .from(products)
      .where(eq(products.organizationId, organizationId))
      .orderBy(asc(products.name), asc(products.sku)),
  ]);

  if (!organization) return null;

  const serializedProducts = records.map((product) =>
    serializeProduct(product, organization.defaultLowStockThreshold),
  );

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      defaultLowStockThreshold: organization.defaultLowStockThreshold,
    },
    totalProducts: serializedProducts.length,
    totalUnits: serializedProducts.reduce(
      (total, product) => total + product.quantityOnHand,
      0,
    ),
    lowStockItems: serializedProducts.filter((product) => product.isLowStock),
  };
}

export function isUniqueConstraintError(error: unknown) {
  const message =
    error instanceof Error
      ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`
      : String(error);

  return /unique constraint|products\.organization_id, products\.sku/i.test(message);
}

export function apiError(error: unknown) {
  if (error instanceof InventoryValidationError) {
    return Response.json(
      { error: error.message, fields: error.fields },
      { status: 400 },
    );
  }

  if (isUniqueConstraintError(error)) {
    return Response.json(
      {
        error: "A product with this SKU already exists in your organization.",
        fields: { sku: "SKU must be unique within your organization." },
      },
      { status: 409 },
    );
  }

  console.error("Inventory API error", error);
  return Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
