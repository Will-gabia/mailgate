import { Hono } from "hono";
import { getDb } from "../../db/index.js";
import { parseEmail } from "../../parser/index.js";
import { classifyEmail } from "../../classifier/index.js";
import { forwardEmail } from "../../forwarder/index.js";

const MAX_LIMIT = 100;
const MAX_PAGE = 1000;
const VALID_STATUSES = new Set(["received", "classified", "forwarded", "failed", "archived"]);

const parsePagination = (query: Record<string, string | undefined>) => {
  const pageRaw = Number.parseInt(query.page ?? "", 10);
  const limitRaw = Number.parseInt(query.limit ?? "", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, MAX_PAGE) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20;
  return { page, limit: Math.min(limit, MAX_LIMIT) };
};

export const emailRoutes = new Hono();

emailRoutes.get("/", async (c) => {
  const { status, tenantId } = c.req.query();
  const { page, limit } = parsePagination(c.req.query());
  const skip = (page - 1) * limit;

  if (status && !VALID_STATUSES.has(status)) {
    return c.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, 400);
  }

  const where: { status?: string; tenantId?: string } = {};
  if (status) where.status = status;
  if (tenantId) where.tenantId = tenantId;

  const [total, emails] = await Promise.all([
    getDb().email.count({ where }),
    getDb().email.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        mailFrom: true,
        rcptTo: true,
        remoteIp: true,
        messageId: true,
        subject: true,
        fromHeader: true,
        toHeader: true,
        ccHeader: true,
        replyTo: true,
        date: true,
        headers: true,
        textBody: true,
        htmlBody: true,
        status: true,
        category: true,
        matchedRule: true,
        tenantId: true,
        _count: { select: { attachments: true, forwardLogs: true } },
      },
    }),
  ]);

  return c.json({ data: emails, total, page, limit });
});

emailRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const email = await getDb().email.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      mailFrom: true,
      rcptTo: true,
      remoteIp: true,
      messageId: true,
      subject: true,
      fromHeader: true,
      toHeader: true,
      ccHeader: true,
      replyTo: true,
      date: true,
      headers: true,
      textBody: true,
      htmlBody: true,
      status: true,
      category: true,
      matchedRule: true,
      tenantId: true,
      attachments: true,
      forwardLogs: true,
    },
  });

  if (!email) {
    return c.json({ error: "Email not found" }, 404);
  }

  return c.json({ data: email });
});

emailRoutes.post("/:id/retry", async (c) => {
  const id = c.req.param("id");
  const email = await getDb().email.findUnique({
    where: { id },
  });

  if (!email) {
    return c.json({ error: "Email not found" }, 404);
  }

  if (email.status !== "failed") {
    return c.json({ error: "Only failed emails can be retried" }, 400);
  }

  try {
    // Re-parse the stored raw message
    const parsed = await parseEmail(email.rawMessage);

    // Re-classify the email
    const result = await classifyEmail(parsed, email.tenantId ?? undefined);

    let finalStatus = "classified";

    if (result.matched && result.action === "forward" && result.forwardTo) {
      const success = await forwardEmail(parsed, email.id, result.forwardTo);
      finalStatus = success ? "forwarded" : "failed";
    } else if (result.matched) {
      switch (result.action) {
        case "archive":
          finalStatus = "archived";
          break;
        case "reject":
          finalStatus = "archived";
          break;
        case "log":
        default:
          finalStatus = "classified";
          break;
      }
    }

    await getDb().email.update({
      where: { id },
      data: {
        status: finalStatus,
        category: result.category ?? null,
        matchedRule: result.ruleName ?? null,
      },
    });

    return c.json({
      data: {
        id: email.id,
        previousStatus: email.status,
        newStatus: finalStatus,
        matchedRule: result.ruleName ?? null,
        action: result.action,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Retry failed: ${message}` }, 500);
  }
});
