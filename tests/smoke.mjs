import assert from "node:assert/strict";

const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const runId =
  process.env.STOCKFLOW_TEST_RUN_ID ??
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "Inventory9!";

async function request(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  const setCookies =
    response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")];
  const setCookie = setCookies.find(
    (value) => {
      if (!value?.startsWith("stockflow_session=")) return false;
      return value.split(";", 1)[0].split("=", 2)[1]?.length > 0;
    },
  );

  return {
    response,
    data,
    cookie: setCookie?.split(";", 1)[0],
  };
}

async function signup(email, organizationName) {
  const result = await request("/api/auth/signup", {
    method: "POST",
    body: { email, password, confirmPassword: password, organizationName },
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  assert.ok(result.cookie?.startsWith("stockflow_session="));
  return result.cookie;
}

let cookieA = await signup(`owner-a-${runId}@example.com`, "Northstar Goods");
const signupSessionA = await request("/api/auth/me", { cookie: cookieA });
assert.equal(signupSessionA.response.status, 200, JSON.stringify(signupSessionA.data));
const loginA = await request("/api/auth/login", {
  cookie: cookieA,
  method: "POST",
  body: { email: `owner-a-${runId}@example.com`, password },
});
assert.equal(loginA.response.status, 200, JSON.stringify(loginA.data));
assert.ok(loginA.cookie?.startsWith("stockflow_session="));
cookieA = loginA.cookie;
const sessionA = await request("/api/auth/me", { cookie: cookieA });
assert.equal(sessionA.response.status, 200, JSON.stringify(sessionA.data));
const sku = `FLOW-${runId}`.toUpperCase();

const createdA = await request("/api/products", {
  cookie: cookieA,
  method: "POST",
  body: {
    name: "Canvas Field Pack",
    sku,
    description: "Smoke-test inventory item",
    quantityOnHand: 3,
    costPrice: "18.50",
    sellingPrice: "42.00",
    lowStockThreshold: null,
  },
});
assert.equal(createdA.response.status, 201, JSON.stringify(createdA.data));
const productId = createdA.data.product.id;

const searchA = await request("/api/products?search=canvas", { cookie: cookieA });
assert.equal(searchA.response.status, 200);
assert.equal(searchA.data.products.length, 1);
assert.equal(searchA.data.products[0].id, productId);

const dashboardA = await request("/api/dashboard", { cookie: cookieA });
assert.equal(dashboardA.response.status, 200);
assert.equal(dashboardA.data.totalProducts, 1);
assert.equal(dashboardA.data.totalUnits, 3);
assert.equal(dashboardA.data.lowStockItems.length, 1);

const duplicateA = await request("/api/products", {
  cookie: cookieA,
  method: "POST",
  body: { name: "Duplicate", sku, quantityOnHand: 1 },
});
assert.equal(duplicateA.response.status, 409);

const cookieB = await signup(`owner-b-${runId}@example.com`, "Harbor Supply");
const productsB = await request("/api/products", { cookie: cookieB });
assert.equal(productsB.response.status, 200);
assert.deepEqual(productsB.data.products, []);

const crossTenantRead = await request(`/api/products/${productId}`, { cookie: cookieB });
assert.equal(crossTenantRead.response.status, 404);

const sameSkuB = await request("/api/products", {
  cookie: cookieB,
  method: "POST",
  body: { name: "Independent SKU", sku, quantityOnHand: 8 },
});
assert.equal(sameSkuB.response.status, 201, JSON.stringify(sameSkuB.data));

const updatedA = await request(`/api/products/${productId}`, {
  cookie: cookieA,
  method: "PATCH",
  body: { quantityOnHand: 8 },
});
assert.equal(updatedA.response.status, 200, JSON.stringify(updatedA.data));
assert.equal(updatedA.data.product.isLowStock, false);

const settingsA = await request("/api/settings", {
  cookie: cookieA,
  method: "PATCH",
  body: { defaultLowStockThreshold: 10 },
});
assert.equal(settingsA.response.status, 200, JSON.stringify(settingsA.data));

const dashboardAfterThreshold = await request("/api/dashboard", { cookie: cookieA });
assert.equal(dashboardAfterThreshold.data.lowStockItems.length, 1);

const deletedA = await request(`/api/products/${productId}`, {
  cookie: cookieA,
  method: "DELETE",
});
assert.equal(deletedA.response.status, 200, JSON.stringify(deletedA.data));

const logoutA = await request("/api/auth/logout", {
  cookie: cookieA,
  method: "POST",
});
assert.equal(logoutA.response.status, 204);

const rejectedAfterLogout = await request("/api/products", { cookie: cookieA });
assert.equal(rejectedAfterLogout.response.status, 401);

console.log("StockFlow smoke test passed: auth, CRUD, dashboard, settings, and tenant isolation.");
