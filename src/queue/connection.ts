import IORedis from "ioredis";
import { loadSharedConfig } from "../config/shared.js";
import { logger } from "../config/logger.js";

let connection: IORedis | undefined;

/**
 * Get or create a shared IORedis connection for BullMQ.
 * BullMQ requires a plain IORedis instance (not cluster).
 */
export function getRedisConnection(): IORedis {
  if (!connection) {
    const config = loadSharedConfig();
    connection = new IORedis(config.redis.url, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });
    connection.on("error", (err) => {
      logger.error({ error: err }, "Redis connection error");
    });
    connection.on("connect", () => {
      logger.debug("Redis connected");
    });
  }
  return connection;
}

/**
 * Close the shared Redis connection.
 */
export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = undefined;
    logger.debug("Redis connection closed");
  }
}