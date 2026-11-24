const MAX_QUANTITY = 1_000_000_000;
const MAX_PRICE_CENTS = 10_000_000_000;

export class RequestValidationError extends Error {
  constructor(fields, message = "Please review the highlighted fields.") {
    super(message);
    this.name = "RequestValidationError";
    this.fields = fields;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value, field, label, maxLength, errors) {
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

function optionalText(value, field, label, maxLength, errors) {
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

function nonNegativeInteger(value, field, label, errors) {
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

function optionalNonNegativeInteger(value, field, label, errors) {
  if (value === "" || value === null || value === undefined) return null;
  return nonNegativeInteger(value, field, label, errors);
}

function optionalPrice(value, field, label, errors) {
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

export function parseSignup(payload) {
  if (!isRecord(payload)) {
    throw new RequestValidationError({ form: "A JSON object is required." });
  }

  const errors = {};
  const organizationName = requiredText(
    payload.organizationName,
    "organizationName",
    "Organization name",
    80,
    errors,
  );

  let email;
  if (typeof payload.email !== "string" || !payload.email.trim()) {
    errors.email = "Email is required.";
  } else {
    email = payload.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email address.";
    }
  }

  const password = typeof payload.password === "string" ? payload.password : "";
  if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (password.length > 128) errors.password = "Password must be 128 characters or fewer.";
  else if (!/[a-z]/.test(password)) errors.password = "Password must include a lowercase letter.";
  else if (!/[A-Z]/.test(password)) errors.password = "Password must include an uppercase letter.";
  else if (!/[0-9]/.test(password)) errors.password = "Password must include a number.";

  if (typeof payload.confirmPassword !== "string" || !payload.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (password !== payload.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(errors).length) throw new RequestValidationError(errors);
  return { organizationName, email, password };
}

export function parseLogin(payload) {
  if (!isRecord(payload)) {
    throw new RequestValidationError({ form: "A JSON object is required." });
  }
  const errors = {};
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!password) errors.password = "Password is required.";
  else if (password.length > 128) errors.password = "Password must be 128 characters or fewer.";
  if (Object.keys(errors).length) throw new RequestValidationError(errors);
  return { email, password };
}

export function parseProductMutation(payload, mode) {
  if (!isRecord(payload)) {
    throw new RequestValidationError({ form: "A JSON object is required." });
  }

  const errors = {};
  const mutation = {};
  const create = mode === "create";

  if (create || Object.hasOwn(payload, "name")) {
    mutation.name = requiredText(payload.name, "name", "Product name", 120, errors);
  }
  if (create || Object.hasOwn(payload, "sku")) {
    const sku = requiredText(payload.sku, "sku", "SKU", 64, errors);
    mutation.sku = sku?.toUpperCase();
  }
  if (create || Object.hasOwn(payload, "description")) {
    mutation.description = optionalText(
      payload.description,
      "description",
      "Description",
      1_000,
      errors,
    );
  }
  if (create || Object.hasOwn(payload, "quantityOnHand")) {
    mutation.quantityOnHand = nonNegativeInteger(
      create && !Object.hasOwn(payload, "quantityOnHand") ? 0 : payload.quantityOnHand,
      "quantityOnHand",
      "Quantity on hand",
      errors,
    );
  }
  if (create || Object.hasOwn(payload, "costPrice")) {
    mutation.costPriceCents = optionalPrice(
      payload.costPrice,
      "costPrice",
      "Cost price",
      errors,
    );
  }
  if (create || Object.hasOwn(payload, "sellingPrice")) {
    mutation.sellingPriceCents = optionalPrice(
      payload.sellingPrice,
      "sellingPrice",
      "Selling price",
      errors,
    );
  }
  if (create || Object.hasOwn(payload, "lowStockThreshold")) {
    mutation.lowStockThreshold = optionalNonNegativeInteger(
      payload.lowStockThreshold,
      "lowStockThreshold",
      "Low-stock threshold",
      errors,
    );
  }

  if (mode === "update" && Object.keys(mutation).length === 0) {
    errors.form = "Provide at least one product field to update.";
  }
  if (Object.keys(errors).length) throw new RequestValidationError(errors);
  return mutation;
}

export function parseDefaultThreshold(payload) {
  if (!isRecord(payload)) {
    throw new RequestValidationError({ form: "A JSON object is required." });
  }
  const errors = {};
  const defaultLowStockThreshold = nonNegativeInteger(
    payload.defaultLowStockThreshold,
    "defaultLowStockThreshold",
    "Default low-stock threshold",
    errors,
  );
  if (Object.keys(errors).length) throw new RequestValidationError(errors);
  return defaultLowStockThreshold;
}
