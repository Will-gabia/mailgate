import { getDb } from "../../src/db/index.js";


export async function waitForProcessedEmail(
  subject: string,
  timeoutMs = 10000
) {
  const db = getDb();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const email = await db.email.findFirst({
      where: { subject, NOT: { status: "received" } },
      include: { attachments: true, forwardLogs: true },
      orderBy: { createdAt: "desc" },
    });
    if (email) return email;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for processed email with subject: "${subject}"`);
}


export async function waitForEmail(subject: string, timeoutMs = 10000) {
  const db = getDb();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const email = await db.email.findFirst({
      where: { subject },
      include: { attachments: true, forwardLogs: true },
      orderBy: { createdAt: "desc" },
    });
    if (email) return email;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for email with subject: "${subject}"`);
}
