import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { logger } from "../config/logger.js";

export const EMAIL_QUEUE_NAME = "email-processing";

let queue: Queue | undefined;

/**
 * Get or create the BullMQ email processing queue.
 */
export function getEmailQueue(): Queue {
  if (!queue) {
    queue = new Queue(EMAIL_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 60_000, // 1min, 2min, 4min, 8min, 16min
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return queue;
}

/**
 * Enqueue an email for async processing.
 * Uses emailId as jobId for idempotency.
 */
export async function addEmailJob(emailId: string): Promise<void> {
  const q = getEmailQueue();
  await q.add(
    "process-email",
    { emailId },
    { jobId: emailId },
  );
  logger.debug({ emailId }, "Email job enqueued");
}

/**
 * Close the queue (producer side).
 */
export async function closeEmailQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = undefined;
    logger.debug("Email queue closed");
  }
}