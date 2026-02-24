import { logger } from "../config/logger.js";
import { getDb } from "../db/index.js";
import { forwardEmail } from "../forwarder/index.js";
import { parseEmail } from "../parser/index.js";

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  pollIntervalMs: number;
}

/**
 * Calculate next retry time using exponential backoff.
 * delay = baseDelayMs * 2^(attempts - 1)
 * e.g. 1min, 2min, 4min, 8min, 16min...
 */
function calculateNextRetryAt(attempts: number, baseDelayMs: number): Date {
  const delay = baseDelayMs * Math.pow(2, attempts - 1);
  return new Date(Date.now() + delay);
}

/**
 * Process pending retries: find failed ForwardLogs that are due for retry,
 * re-attempt the forward, and update the log accordingly.
 */
async function processRetries(retryConfig: RetryConfig): Promise<void> {
  const now = new Date();

  // Find failed forward logs that are eligible for retry
  const pendingRetries = await getDb().forwardLog.findMany({
    where: {
      status: "failed",
      attempts: { lt: retryConfig.maxAttempts },
      nextRetryAt: { lte: now },
    },
    include: {
      email: {
        select: {
          id: true,
          rawMessage: true,
          tenantId: true,
        },
      },
    },
  });

  if (pendingRetries.length === 0) return;

  logger.info({ count: pendingRetries.length }, "Processing pending forward retries");

  for (const log of pendingRetries) {
    try {
      // Re-parse the raw message for forwarding
      const parsed = await parseEmail(log.email.rawMessage);

      // Attempt to re-forward to the single recipient
      const success = await forwardEmail(parsed, log.email.id, log.forwardTo);

      if (success) {
        // Update the ForwardLog to success
        await getDb().forwardLog.update({
          where: { id: log.id },
          data: {
            status: "success",
            attempts: log.attempts + 1,
            nextRetryAt: null,
          },
        });

        // Check if all forward logs for this email are now successful
        const remainingFailed = await getDb().forwardLog.count({
          where: {
            emailId: log.email.id,
            status: "failed",
          },
        });

        if (remainingFailed === 0) {
          await getDb().email.update({
            where: { id: log.email.id },
            data: { status: "forwarded" },
          });
        }

        logger.info(
          { forwardLogId: log.id, emailId: log.email.id, forwardTo: log.forwardTo, attempt: log.attempts + 1 },
          "Retry forward succeeded"
        );
      } else {
        const newAttempts = log.attempts + 1;
        const nextRetryAt =
          newAttempts < retryConfig.maxAttempts
            ? calculateNextRetryAt(newAttempts, retryConfig.baseDelayMs)
            : null;

        await getDb().forwardLog.update({
          where: { id: log.id },
          data: {
            attempts: newAttempts,
            nextRetryAt,
          },
        });

        logger.warn(
          {
            forwardLogId: log.id,
            emailId: log.email.id,
            attempt: newAttempts,
            maxAttempts: retryConfig.maxAttempts,
            nextRetryAt,
          },
          "Retry forward failed, will retry later"
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      const newAttempts = log.attempts + 1;
      const nextRetryAt =
        newAttempts < retryConfig.maxAttempts
          ? calculateNextRetryAt(newAttempts, retryConfig.baseDelayMs)
          : null;

      await getDb().forwardLog.update({
        where: { id: log.id },
        data: {
          attempts: newAttempts,
          error: errorMessage,
          nextRetryAt,
        },
      });

      logger.error(
        { forwardLogId: log.id, error: errorMessage, attempt: newAttempts },
        "Retry forward threw an error"
      );
    }
  }
}

let retryInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background retry worker that periodically checks for
 * failed forward logs and re-attempts forwarding with exponential backoff.
 */
export function startRetryWorker(retryConfig: RetryConfig): void {
  if (retryInterval) {
    logger.warn("Retry worker already running");
    return;
  }

  logger.info(
    {
      maxAttempts: retryConfig.maxAttempts,
      baseDelayMs: retryConfig.baseDelayMs,
      pollIntervalMs: retryConfig.pollIntervalMs,
    },
    "Starting retry worker"
  );

  retryInterval = setInterval(() => {
    processRetries(retryConfig).catch((err) => {
      logger.error({ error: err }, "Retry worker cycle failed");
    });
  }, retryConfig.pollIntervalMs);

  // Run once immediately
  processRetries(retryConfig).catch((err) => {
    logger.error({ error: err }, "Initial retry worker cycle failed");
  });
}

/**
 * Stop the retry worker.
 */
export function stopRetryWorker(): void {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
    logger.info("Retry worker stopped");
  }
}