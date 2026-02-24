import pino from "pino";
import { loadSharedConfig } from "./shared.js";

const config = loadSharedConfig();

export const logger = pino({
  level: config.logLevel,
  transport:
    config.env === "development"
      ? {
          target: "pino/file",
          options: { destination: 1 },
        }
      : undefined,
});
