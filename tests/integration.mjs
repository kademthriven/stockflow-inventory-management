import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const runId = randomUUID();
const port = 20_000 + Math.floor(Math.random() * 20_000);
const externalBaseUrl = process.env.STOCKFLOW_TEST_URL?.replace(/\/$/, "");
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`;
const environment = {
  ...process.env,
  HOST: "127.0.0.1",
  NODE_ENV: "development",
  PORT: String(port),
  STOCKFLOW_TEST_RUN_ID: runId,
};

let serverOutput = "";
let failure;
const server = externalBaseUrl
  ? null
  : spawn(process.execPath, ["server/index.mjs"], {
      cwd: process.cwd(),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
server?.stdout.setEncoding("utf8").on("data", (chunk) => {
  serverOutput += chunk;
});
server?.stderr.setEncoding("utf8").on("data", (chunk) => {
  serverOutput += chunk;
});

async function waitForServer() {
  assert.ok(server);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`StockFlow exited before becoming ready.\n${serverOutput}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await delay(500);
      continue;
    }
    await delay(500);
  }
  throw new Error(`StockFlow did not become ready.\n${serverOutput}`);
}

async function runSmokeTest() {
  const smoke = spawn(
    process.execPath,
    ["tests/smoke.mjs", baseUrl],
    { cwd: process.cwd(), env: environment, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  smoke.stdout.setEncoding("utf8").on("data", (chunk) => {
    output += chunk;
  });
  smoke.stderr.setEncoding("utf8").on("data", (chunk) => {
    output += chunk;
  });

  const [code, signal] = await new Promise((resolve, reject) => {
    smoke.once("error", reject);
    smoke.once("close", (exitCode, exitSignal) =>
      resolve([exitCode, exitSignal]),
    );
  });
  assert.equal(code, 0, `Smoke test failed (${signal ?? code}).\n${output}`);
  process.stdout.write(output);
}

async function cleanTestData() {
  const { loadEnvConfig } = (await import("@next/env")).default;
  loadEnvConfig(process.cwd());
  const { Op } = await import("sequelize");
  const { closeDatabase, database, initializeDatabase } =
    await import("../server/database.mjs");
  const emails = [
    `owner-a-${runId}@example.com`,
    `owner-b-${runId}@example.com`,
  ];

  try {
    await initializeDatabase(database);
    const users = await database.User.findAll({
      attributes: ["id", "organizationId"],
      where: { email: { [Op.in]: emails } },
    });
    if (!users.length) return;

    const userIds = users.map((user) => user.id);
    const organizationIds = [
      ...new Set(users.map((user) => user.organizationId)),
    ];
    await database.sequelize.transaction(async (transaction) => {
      await database.Session.destroy({
        where: { userId: { [Op.in]: userIds } },
        transaction,
      });
      await database.Product.destroy({
        where: { organizationId: { [Op.in]: organizationIds } },
        transaction,
      });
      await database.User.destroy({
        where: { id: { [Op.in]: userIds } },
        transaction,
      });
      await database.Organization.destroy({
        where: { id: { [Op.in]: organizationIds } },
        transaction,
      });
    });
  } finally {
    await closeDatabase(database);
  }
}

try {
  if (server) await waitForServer();
  await runSmokeTest();
} catch (error) {
  failure = error;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("close", resolve);
      if (server.exitCode !== null) resolve();
    });
  }
  try {
    await cleanTestData();
  } catch (error) {
    if (failure) {
      console.error("Failed to remove integration-test data.", error);
    } else {
      failure = error;
    }
  }
}

if (failure) throw failure;
console.log("Integration test completed and temporary test data was removed.");
