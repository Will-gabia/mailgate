import { Hono } from "hono";
import { getDb } from "../../db/index.js";

const MAX_LIMIT = 100;
const MAX_PAGE = 1000;
const VALID_STATUSES = new Set(["pending", "success", "failed"]);

const parsePagination = (query: Record<string, string | undefined>) => {
  const pageRaw = Number.parseInt(query.page ?? "", 10);
  const limitRaw = Number.parseInt(query.limit ?? "", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, MAX_PAGE) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20;
  return { page, limit: Math.min(limit, MAX_LIMIT) };
};

export const forwardLogRoutes = new Hono();

forwardLogRoutes.get("/", async (c) => {
  const { emailId, status } = c.req.query();
  const { page, limit } = parsePagination(c.req.query());
  const skip = (page - 1) * limit;

  if (status && !VALID_STATUSES.has(status)) {
    return c.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, 400);
  }

  const where: { emailId?: string; status?: string } = {};
  if (emailId) where.emailId = emailId;
  if (status) where.status = status;

  const [total, logs] = await Promise.all([
    getDb().forwardLog.count({ where }),
    getDb().forwardLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
  ]);

  return c.json({ data: logs, total, page, limit });
});
