import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { loadApiConfig } from "../config/api.js";
import { connectDb, disconnectDb } from "../db/index.js";
import { logger } from "../config/logger.js";
import { apiKeyAuth, apiRateLimit } from "./middleware/security.js";
import { emailRoutes } from "./routes/emails.js";
import { tenantRoutes } from "./routes/tenants.js";
import { ruleRoutes } from "./routes/rules.js";
import { forwardLogRoutes } from "./routes/forward-logs.js";
import { statsRoutes } from "./routes/stats.js";

const config = loadApiConfig();

const app = new Hono();

const corsOrigins = config.api.corsOrigins;
app.use(
  "*",
  cors({
    origin: corsOrigins.includes("*") ? "*" : corsOrigins,
  })
);
app.use("*", honoLogger());
app.use("/api/*", apiRateLimit(config));
app.use("/api/*", apiKeyAuth(config));

app.onError((err, c) => {
  logger.error({ error: err }, "Unhandled API error");
  return c.json({ error: "Internal server error" }, 500);
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/api/emails", emailRoutes);
app.route("/api/tenants", tenantRoutes);
app.route("/api/rules", ruleRoutes);
app.route("/api/forward-logs", forwardLogRoutes);
app.route("/api/stats", statsRoutes);

app.use("*", serveStatic({ root: "./dashboard/dist" }));

app.get("*", serveStatic({ root: "./dashboard/dist", path: "index.html" }));

async function main() {
  await connectDb();

  if (config.api.apiKey) {
    logger.info("API key authentication enabled");
  } else {
    logger.warn("API_KEY not set — API endpoints are unprotected");
  }

  serve(
    {
      fetch: app.fetch,
      port: config.api.port,
      hostname: config.api.host,
    },
    (info) => {
      logger.info(
        { host: config.api.host, port: info.port },
        "API server listening"
      );
    }
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down API server...");
    await disconnectDb();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ error: err }, "Failed to start API server");
  process.exit(1);
});
