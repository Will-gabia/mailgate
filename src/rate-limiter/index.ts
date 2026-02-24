import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  total: number;
}

interface BucketEntry {
  timestamps: number[];
}

const buckets = new Map<string, BucketEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, "");
}

export function checkRateLimit(ip: string): RateLimitResult {
  if (!config.rateLimit.enabled) {
    return {
      allowed: true,
      remaining: config.rateLimit.maxPerWindow,
      resetAt: Date.now() + config.rateLimit.windowMs,
      total: config.rateLimit.maxPerWindow,
    };
  }

  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const maxPerWindow = config.rateLimit.maxPerWindow;
  const normalizedIp = normalizeIp(ip);

  let entry = buckets.get(normalizedIp);
  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(normalizedIp, entry);
  }

  // Remove timestamps outside the current window
  const windowStart = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const currentCount = entry.timestamps.length;

  if (currentCount >= maxPerWindow) {
    const oldestInWindow = entry.timestamps[0];
    const resetAt = oldestInWindow + windowMs;

    logger.warn(
      {
        ip: normalizedIp,
        count: currentCount,
        maxPerWindow,
        windowMs,
        resetAt: new Date(resetAt).toISOString(),
      },
      "Rate limit exceeded"
    );

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      total: maxPerWindow,
    };
  }

  // Record this connection
  entry.timestamps.push(now);

  const remaining = maxPerWindow - entry.timestamps.length;
  const resetAt =
    entry.timestamps.length > 0
      ? entry.timestamps[0] + windowMs
      : now + windowMs;

  return {
    allowed: true,
    remaining,
    resetAt,
    total: maxPerWindow,
  };
}

/**
 * Periodically clean up expired buckets to prevent memory leaks.
 * Runs every windowMs interval.
 */
export function startCleanup(): void {
  if (cleanupTimer) return;

  const interval = Math.max(config.rateLimit.windowMs, 60000);
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const windowMs = config.rateLimit.windowMs;

    for (const [ip, entry] of buckets) {
      entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs);
      if (entry.timestamps.length === 0) {
        buckets.delete(ip);
      }
    }
  }, interval);

  // Allow the process to exit even if cleanup is scheduled
  cleanupTimer.unref();
}

export function stopCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Reset all rate limit state. Useful for testing.
 */
export function resetRateLimiter(): void {
  buckets.clear();
}
