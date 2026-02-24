import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../../db/index.js";

export const ruleRoutes = new Hono();

const VALID_ACTIONS = ["forward", "log", "archive", "reject"] as const;
const VALID_MATCH_MODES = ["all", "any"] as const;
const VALID_FIELDS = ["subject", "from", "to", "cc", "body", "header"] as const;
const VALID_OPERATORS = [
  "contains",
  "equals",
  "startsWith",
  "endsWith",
  "regex",
  "notContains",
] as const;

const ruleConditionSchema = z.object({
  field: z.enum(VALID_FIELDS),
  operator: z.enum(VALID_OPERATORS),
  value: z.string().min(1),
  headerName: z.string().optional(),
});

const conditionsArraySchema = z.array(ruleConditionSchema).min(1);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseConditions = (
  raw: string
): { success: true; data: z.infer<typeof conditionsArraySchema> } | { success: false; error: string } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, error: "Conditions must be a valid JSON string" };
  }
  if (!Array.isArray(parsed)) {
    return { success: false, error: "Conditions must be a JSON array" };
  }
  const result = conditionsArraySchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: `Invalid condition: ${issue.path.join(".")} — ${issue.message}`,
    };
  }
  return { success: true, data: result.data };
};



ruleRoutes.get("/", async (c) => {
  const { tenantId } = c.req.query();
  const where: { tenantId?: string } = {};
  if (tenantId) where.tenantId = tenantId;

  const rules = await getDb().classificationRule.findMany({
    where,
    orderBy: { priority: "desc" },
  });

  return c.json({ data: rules });
});

ruleRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const rule = await getDb().classificationRule.findUnique({ where: { id } });
  if (!rule) {
    return c.json({ error: "Rule not found" }, 404);
  }
  return c.json({ data: rule });
});



ruleRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const conditionsRaw = typeof body.conditions === "string" ? body.conditions : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";

  if (!name) return c.json({ error: "Name is required" }, 400);
  if (!conditionsRaw) return c.json({ error: "Conditions are required" }, 400);
  if (!action) return c.json({ error: "Action is required" }, 400);


  if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
    return c.json(
      { error: `Invalid action: must be one of ${VALID_ACTIONS.join(", ")}` },
      400
    );
  }


  const conditionsResult = parseConditions(conditionsRaw);
  if (!conditionsResult.success) {
    return c.json({ error: conditionsResult.error }, 400);
  }


  if (action === "forward") {
    const forwardTo = typeof body.forwardTo === "string" ? body.forwardTo.trim() : "";
    if (!forwardTo) {
      return c.json({ error: "forwardTo is required when action is forward" }, 400);
    }
    if (!EMAIL_REGEX.test(forwardTo)) {
      return c.json({ error: "forwardTo must be a valid email address" }, 400);
    }
  }


  if (typeof body.priority === "number") {
    if (!Number.isInteger(body.priority) || body.priority < 0 || body.priority > 1000) {
      return c.json({ error: "Priority must be an integer between 0 and 1000" }, 400);
    }
  }


  // matchMode validation
  if (typeof body.matchMode === "string") {
    if (!(VALID_MATCH_MODES as readonly string[]).includes(body.matchMode)) {
      return c.json({ error: `Invalid matchMode: must be one of ${VALID_MATCH_MODES.join(", ")}` }, 400);
    }
  }
  const rule = await getDb().classificationRule.create({
    data: {
      name,
      description: typeof body.description === "string" ? body.description : undefined,
      priority: typeof body.priority === "number" ? body.priority : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      conditions: conditionsRaw,
      action,
      forwardTo: typeof body.forwardTo === "string" ? body.forwardTo.trim() : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      matchMode: typeof body.matchMode === "string" ? body.matchMode : undefined,
    },
  });

  return c.json({ data: rule }, 201);
});



ruleRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const data: {
    name?: string;
    description?: string | null;
    priority?: number;
    enabled?: boolean;
    conditions?: string;
    action?: string;
    forwardTo?: string | null;
    category?: string | null;
    tenantId?: string | null;
    matchMode?: string;
  } = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) {
    data.description = body.description;
  }


  if (typeof body.priority === "number") {
    if (!Number.isInteger(body.priority) || body.priority < 0 || body.priority > 1000) {
      return c.json({ error: "Priority must be an integer between 0 and 1000" }, 400);
    }
    data.priority = body.priority;
  }

  if (typeof body.enabled === "boolean") data.enabled = body.enabled;


  if (typeof body.conditions === "string") {
    const conditionsResult = parseConditions(body.conditions);
    if (!conditionsResult.success) {
      return c.json({ error: conditionsResult.error }, 400);
    }
    data.conditions = body.conditions;
  }


  // matchMode validation
  if (typeof body.matchMode === "string") {
    if (!(VALID_MATCH_MODES as readonly string[]).includes(body.matchMode)) {
      return c.json({ error: `Invalid matchMode: must be one of ${VALID_MATCH_MODES.join(", ")}` }, 400);
    }
    data.matchMode = body.matchMode;
  }
  if (typeof body.action === "string") {
    const action = body.action.trim();
    if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
      return c.json(
        { error: `Invalid action: must be one of ${VALID_ACTIONS.join(", ")}` },
        400
      );
    }
    data.action = action;
  }


  if (typeof body.forwardTo === "string") {
    const forwardTo = body.forwardTo.trim();
    if (forwardTo && !EMAIL_REGEX.test(forwardTo)) {
      return c.json({ error: "forwardTo must be a valid email address" }, 400);
    }
    data.forwardTo = forwardTo || null;
  } else if (body.forwardTo === null) {
    data.forwardTo = null;
  }

  if (typeof body.category === "string" || body.category === null) {
    data.category = body.category;
  }
  if (typeof body.tenantId === "string" || body.tenantId === null) {
    data.tenantId = body.tenantId;
  }

  try {
    const rule = await getDb().classificationRule.update({ where: { id }, data });
    return c.json({ data: rule });
  } catch {
    return c.json({ error: "Rule not found" }, 404);
  }
});



ruleRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await getDb().classificationRule.delete({ where: { id } });
    return c.json({ data: { id } });
  } catch {
    return c.json({ error: "Rule not found" }, 404);
  }
});
