import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { loadSharedConfig, type SharedConfig } from "./shared.js";

const smtpEnvSchema = z.object({
  SMTP_HOST: z.string().default("0.0.0.0"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(2525),
  SMTP_ALLOWED_IPS: z.string().default("127.0.0.1"),
  SMTP_TLS_ENABLED: z.preprocess(
    (v) => (v === undefined ? "false" : v),
    z.string().transform((v) => v === "true")
  ),
  SMTP_TLS_KEY: z.string().default(""),
  SMTP_TLS_CERT: z.string().default(""),
  SMTP_TLS_CA: z.string().default(""),
  RELAY_SMTP_HOST: z.string().default(""),
  RELAY_SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  RELAY_SMTP_SECURE: z.preprocess(
    (v) => (v === undefined ? "true" : v),
    z.string().transform((v) => v === "true")
  ),
  RELAY_SMTP_USER: z.string().default(""),
  RELAY_SMTP_PASS: z.string().default(""),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX_PER_WINDOW: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_ENABLED: z.preprocess(
    (v) => (v === undefined ? "true" : v),
    z.string().transform((v) => v === "true")
  ),
  RETRY_ENABLED: z.preprocess(
    (v) => (v === undefined ? "true" : v),
    z.string().transform((v) => v === "true")
  ),
  RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  RETRY_BASE_DELAY_MS: z.coerce.number().int().min(1000).default(60000),
  RETRY_POLL_INTERVAL_MS: z.coerce.number().int().min(5000).default(30000),
});

type SmtpEnv = z.infer<typeof smtpEnvSchema>;

type SmtpSpecificConfig = {
  smtp: {
    host: SmtpEnv["SMTP_HOST"];
    port: SmtpEnv["SMTP_PORT"];
    allowedIps: string[];
    tls: {
      enabled: SmtpEnv["SMTP_TLS_ENABLED"];
      key?: string;
      cert?: string;
      ca?: string;
    };
  };
  relay: {
    host: SmtpEnv["RELAY_SMTP_HOST"];
    port: SmtpEnv["RELAY_SMTP_PORT"];
    secure: SmtpEnv["RELAY_SMTP_SECURE"];
    auth?: { user: SmtpEnv["RELAY_SMTP_USER"]; pass: SmtpEnv["RELAY_SMTP_PASS"] };
  };
  rateLimit: {
    enabled: SmtpEnv["RATE_LIMIT_ENABLED"];
    windowMs: SmtpEnv["RATE_LIMIT_WINDOW_MS"];
    maxPerWindow: SmtpEnv["RATE_LIMIT_MAX_PER_WINDOW"];
  };
  retry: {
    enabled: boolean;
    maxAttempts: number;
    baseDelayMs: number;
    pollIntervalMs: number;
  };
};

export type SmtpConfig = SharedConfig & SmtpSpecificConfig;

let cachedSmtpConfig: SmtpConfig | undefined;

function readTlsFile(filePath: string): string {
  if (!existsSync(filePath)) {
    console.error(`❌ TLS file not found: ${filePath}`);
    process.exit(1);
  }
  return readFileSync(filePath, "utf-8");
}

export function loadSmtpConfig(): SmtpConfig {
  if (cachedSmtpConfig) {
    return cachedSmtpConfig;
  }

  const sharedConfig = loadSharedConfig();
  const parsed = smtpEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const env = parsed.data;

  cachedSmtpConfig = {
    ...sharedConfig,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      allowedIps: env.SMTP_ALLOWED_IPS.split(",").map((ip) => ip.trim()),
      tls: {
        enabled: env.SMTP_TLS_ENABLED,
        key: env.SMTP_TLS_KEY ? readTlsFile(env.SMTP_TLS_KEY) : undefined,
        cert: env.SMTP_TLS_CERT ? readTlsFile(env.SMTP_TLS_CERT) : undefined,
        ca: env.SMTP_TLS_CA ? readTlsFile(env.SMTP_TLS_CA) : undefined,
      },
    },
    relay: {
      host: env.RELAY_SMTP_HOST,
      port: env.RELAY_SMTP_PORT,
      secure: env.RELAY_SMTP_SECURE,
      auth:
        env.RELAY_SMTP_USER && env.RELAY_SMTP_PASS
          ? { user: env.RELAY_SMTP_USER, pass: env.RELAY_SMTP_PASS }
          : undefined,
    },
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxPerWindow: env.RATE_LIMIT_MAX_PER_WINDOW,
    },
    retry: {
      enabled: env.RETRY_ENABLED,
      maxAttempts: env.RETRY_MAX_ATTEMPTS,
      baseDelayMs: env.RETRY_BASE_DELAY_MS,
      pollIntervalMs: env.RETRY_POLL_INTERVAL_MS,
    },
  };

  return cachedSmtpConfig;
}
