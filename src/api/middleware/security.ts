import type { Context, Next } from "hono";
import type { ApiConfig } from "../../config/api.js";

export function apiKeyAuth(config: ApiConfig) {
  return async (c: Context, next: Next) => {
    if (!config.api.apiKey) return next();

    if (c.req.path === "/api/health") return next();

    const key =
      c.req.header("x-api-key") ??
      c.req.query("api_key");

    if (key !== config.api.apiKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return next();
  };
}

interface ApiBucket {
  timestamps: number[];
}

const apiBuckets = new Map<string, ApiBucket>();

export function apiRateLimit(config: ApiConfig) {
  const { maxPerWindow, windowMs } = config.api.rateLimit;

  const cleanupInterval = Math.max(windowMs, 60000);
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of apiBuckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => t > now - windowMs);
      if (bucket.timestamps.length === 0) apiBuckets.delete(ip);
    }
  }, cleanupInterval);
  timer.unref();

  return async (c: Context, next: Next) => {
    const ip = (c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown").replace(/^::ffff:/, "");

    const now = Date.now();
    let bucket = apiBuckets.get(ip);
    if (!bucket) {
      bucket = { timestamps: [] };
      apiBuckets.set(ip, bucket);
    }

    bucket.timestamps = bucket.timestamps.filter((t) => t > now - windowMs);

    if (bucket.timestamps.length >= maxPerWindow) {
      const resetAt = bucket.timestamps[0] + windowMs;
      c.header("Retry-After", String(Math.ceil((resetAt - now) / 1000)));
      return c.json({ error: "Too many requests" }, 429);
    }

    bucket.timestamps.push(now);

    c.header("X-RateLimit-Limit", String(maxPerWindow));
    c.header("X-RateLimit-Remaining", String(maxPerWindow - bucket.timestamps.length));

    return next();
  };
}