import { connectDb, disconnectDb } from "./db/index.js";
import { startEmailWorker, stopEmailWorker, closeRedisConnection } from "./queue/index.js";
import { logger } from "./config/logger.js";

/**
 * Standalone BullMQ worker entrypoint.
 * Run with: node dist/worker.js
 * Or via pm2: pm2 start dist/worker.js --name mail-worker
 */
async function main(): Promise<void> {
  await connectDb();

  startEmailWorker();
  logger.info("Mail gateway worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Worker shutting down...");

    await stopEmailWorker();
    await closeRedisConnection();
    await disconnectDb();

    logger.info("Worker shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("uncaughtException", (err) => {
    logger.fatal({ error: err }, "Uncaught exception in worker");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled rejection in worker");
    process.exit(1);
  });
}

main().catch((err) => {
  logger.fatal({ error: err }, "Failed to start worker");
  process.exit(1);
});