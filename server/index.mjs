import process from "node:process";

const production =
  process.argv.includes("--production") || process.env.NODE_ENV === "production";
process.env.NODE_ENV = production ? "production" : "development";

const { loadEnvConfig } = (await import("@next/env")).default;
loadEnvConfig(process.cwd());

const [
  { default: createNextApp },
  { createApiApp },
  { closeDatabase, database, initializeDatabase },
] = await Promise.all([
  import("next"),
  import("./api.mjs"),
  import("./database.mjs"),
]);
const nextApp = createNextApp({ dev: !production, dir: process.cwd() });

await initializeDatabase(database);
await nextApp.prepare();

const app = createApiApp({ database });
const handleNextRequest = nextApp.getRequestHandler();
app.use((request, response) => handleNextRequest(request, response));

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";
const server = app.listen(port, host, () => {
  console.log(`StockFlow listening on http://${host}:${port}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing StockFlow.`);
  server.close(async () => {
    try {
      await closeDatabase(database);
      process.exit(0);
    } catch (error) {
      console.error("Failed to close the database cleanly", error);
      process.exit(1);
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
