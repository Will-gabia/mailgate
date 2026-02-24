import { Hono } from "hono";
import { getDb } from "../../db/index.js";

export const statsRoutes = new Hono();

statsRoutes.get("/", async (c) => {
  const db = getDb();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalEmails,
    totalTenants,
    totalRules,
    receivedCount,
    classifiedCount,
    forwardedCount,
    failedCount,
    archivedCount,
    emailsToday,
    recentEmails,
  ] = await Promise.all([
    db.email.count(),
    db.tenant.count(),
    db.classificationRule.count(),
    db.email.count({ where: { status: "received" } }),
    db.email.count({ where: { status: "classified" } }),
    db.email.count({ where: { status: "forwarded" } }),
    db.email.count({ where: { status: "failed" } }),
    db.email.count({ where: { status: "archived" } }),
    db.email.count({ where: { createdAt: { gte: startOfToday } } }),
    db.email.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        subject: true,
        fromHeader: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return c.json({
    data: {
      totalEmails,
      emailsByStatus: {
        received: receivedCount,
        classified: classifiedCount,
        forwarded: forwardedCount,
        failed: failedCount,
        archived: archivedCount,
      },
      emailsToday,
      totalTenants,
      totalRules,
      recentEmails,
    },
  });
});
