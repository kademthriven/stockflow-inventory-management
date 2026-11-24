import express from "express";

import { createApiApp } from "../server/api.mjs";
import { database } from "../server/database.mjs";

const app = express();
app.disable("x-powered-by");

app.use((request, response, next) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/index" || url.pathname === "/api/index.mjs") {
    const path = url.searchParams.get("path");
    if (path) {
      url.searchParams.delete("path");
      request.url = `/api/${path.replace(/^\/+/, "")}${url.search}`;
    }
  }
  next();
});

app.use(createApiApp({ database }));

export default app;
