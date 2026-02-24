import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "file:./data/test-mail-gateway.db",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "9925",
      SMTP_ALLOWED_IPS: "127.0.0.1",
      RELAY_SMTP_HOST: "127.0.0.1",
      RELAY_SMTP_PORT: "9926",
      RELAY_SMTP_SECURE: "false",
      RELAY_SMTP_USER: "",
      RELAY_SMTP_PASS: "",
      SMTP_TLS_ENABLED: "false",
      ATTACHMENT_STORAGE_DIR: "./data/test-attachments",
      RATE_LIMIT_ENABLED: "true",
      RATE_LIMIT_WINDOW_MS: "60000",
      RATE_LIMIT_MAX_PER_WINDOW: "100",
      API_HOST: "127.0.0.1",
      API_PORT: "3333",
      LOG_LEVEL: "error",
      NODE_ENV: "test",
      REDIS_URL: "redis://127.0.0.1:6379",
    },
    testTimeout: 30000,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
