import { PrismaClient } from "@prisma/client";
import { logger } from "../config/logger.js";

let prisma: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: "error", emit: "event" },
        { level: "warn", emit: "event" },
      ],
    });

    prisma.$on("error" as never, (e: unknown) => {
      logger.error(e, "Prisma error");
    });

    prisma.$on("warn" as never, (e: unknown) => {
      logger.warn(e, "Prisma warning");
    });
  }
  return prisma;
}

export async function connectDb(): Promise<void> {
  const db = getDb();
  await db.$connect();
  logger.info("Database connected");
}

export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    logger.info("Database disconnected");
  }
}
