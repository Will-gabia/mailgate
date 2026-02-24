import { connectDb, disconnectDb } from "./db/index.js";
import { createSmtpServer, startSmtpServer } from "./smtp/index.js";
import { verifyTransport } from "./forwarder/index.js";
import { logger } from "./config/logger.js";
import {
  startEmailWorker,
  stopEmailWorker,
  closeEmailQueue,
  closeRedisConnection,
} from "./queue/index.js";

async function main(): Promise<void> {
  await connectDb();

  await verifyTransport();

  const smtpServer = createSmtpServer();
  await startSmtpServer(smtpServer);

  // For production with pm2, use src/worker.ts as a separate process
  startEmailWorker();
  logger.info("Embedded email processing worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");


    smtpServer.close(() => {
      logger.info("SMTP server closed");
    });


    await stopEmailWorker();


    await closeEmailQueue();
    await closeRedisConnection();


    await disconnectDb();

    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("uncaughtException", (err) => {
    logger.fatal({ error: err }, "Uncaught exception");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled rejection");
    process.exit(1);
  });
}

main().catch((err) => {
  logger.fatal({ error: err }, "Failed to start application");
  process.exit(1);
});
