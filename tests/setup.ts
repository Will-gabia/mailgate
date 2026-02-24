import { beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { createSmtpServer, startSmtpServer } from "../src/smtp/index.js";
import { connectDb, disconnectDb } from "../src/db/index.js";
import { config } from "../src/config/index.js";
import { resetDatabase } from "./helpers/db.js";
import { resetRateLimiter } from "../src/rate-limiter/index.js";
import {
  startEmailWorker,
  stopEmailWorker,
  closeEmailQueue,
  closeRedisConnection,
  getEmailQueue,
} from "../src/queue/index.js";
import type { Worker } from "bullmq";
import type { EmailJobData } from "../src/queue/index.js";

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/test-mail-gateway.db";

let smtpServer: ReturnType<typeof createSmtpServer> | null = null;
let emailWorker: Worker<EmailJobData> | null = null;

beforeAll(async () => {
  execSync("npx prisma db push --force-reset", {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: "inherit",
  });
  await connectDb();
  smtpServer = createSmtpServer();
  await startSmtpServer(smtpServer);

  emailWorker = startEmailWorker();
  await emailWorker.waitUntilReady();
});

beforeEach(async () => {
  await resetDatabase();
  await rm(config.storage.attachmentDir, { recursive: true, force: true });
  resetRateLimiter();
  // Drain BullMQ queue to prevent leftover jobs from previous tests
  const queue = getEmailQueue();
  await queue.drain();
});

afterAll(async () => {
  await stopEmailWorker();
  await closeEmailQueue();
  await closeRedisConnection();

  if (smtpServer) {
    await new Promise<void>((resolve) => smtpServer?.close(() => resolve()));
  }
  await disconnectDb();
  await rm(config.storage.attachmentDir, { recursive: true, force: true });
});
