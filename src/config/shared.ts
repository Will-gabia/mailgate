import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ATTACHMENT_STORAGE_DIR: z.string().default("./data/attachments"),
  MAX_MESSAGE_SIZE_MB: z.coerce.number().min(1).default(25),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

type SharedEnv = z.infer<typeof sharedEnvSchema>;

export type SharedConfig = {
  env: SharedEnv["NODE_ENV"];
  logLevel: SharedEnv["LOG_LEVEL"];
  db: { url: SharedEnv["DATABASE_URL"] };
  storage: { attachmentDir: SharedEnv["ATTACHMENT_STORAGE_DIR"] };
  messageSize: { maxBytes: number };
  redis: { url: string };
};

let cachedSharedConfig: SharedConfig | undefined;

export function loadSharedConfig(): SharedConfig {
  if (cachedSharedConfig) {
    return cachedSharedConfig;
  }

  const parsed = sharedEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const env = parsed.data;

  cachedSharedConfig = {
    env: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    db: {
      url: env.DATABASE_URL,
    },
    storage: {
      attachmentDir: env.ATTACHMENT_STORAGE_DIR,
    },
    messageSize: {
      maxBytes: env.MAX_MESSAGE_SIZE_MB * 1024 * 1024,
    },
    redis: {
      url: env.REDIS_URL,
    },
  };

  return cachedSharedConfig;
}
