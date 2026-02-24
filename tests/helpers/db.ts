import { getDb } from "../../src/db/index.js";

export async function resetDatabase(): Promise<void> {
  const db = getDb();
  await db.$executeRawUnsafe("DELETE FROM ForwardLog;");
  await db.$executeRawUnsafe("DELETE FROM Attachment;");
  await db.$executeRawUnsafe("DELETE FROM Email;");
  await db.$executeRawUnsafe("DELETE FROM ClassificationRule;");
  await db.$executeRawUnsafe("DELETE FROM Tenant;");
}
