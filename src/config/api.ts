import { z } from "zod";
import { loadSharedConfig, type SharedConfig } from "./shared.js";

const apiEnvSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_KEY: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().default("*"),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(200),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
});

export type ApiConfig = SharedConfig & {
  api: {
    host: string;
    port: number;
    apiKey: string | undefined;
    corsOrigins: string[];
    rateLimit: {
      maxPerWindow: number;
      windowMs: number;
    };
  };
};

let cachedApiConfig: ApiConfig | undefined;

export function loadApiConfig(): ApiConfig {
  if (cachedApiConfig) {
    return cachedApiConfig;
  }

  const sharedConfig = loadSharedConfig();
  const parsed = apiEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const env = parsed.data;

  // Parse CORS_ORIGINS: "*" means all, otherwise comma-separated list
  const corsOrigins =
    env.CORS_ORIGINS === "*"
      ? ["*"]
      : env.CORS_ORIGINS.split(",")
          .map((o) => o.trim())
          .filter(Boolean);

  cachedApiConfig = {
    ...sharedConfig,
    api: {
      host: env.API_HOST,
      port: env.API_PORT,
      apiKey: env.API_KEY,
      corsOrigins,
      rateLimit: {
        maxPerWindow: env.API_RATE_LIMIT_MAX,
        windowMs: env.API_RATE_LIMIT_WINDOW_MS,
      },
    },
  };

  return cachedApiConfig;
}
