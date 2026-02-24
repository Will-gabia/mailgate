import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../../db/index.js";

export const tenantRoutes = new Hono();

const parseDomains = (value: string | undefined) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      return null;
    }
    return parsed as string[];
  } catch {
    return null;
  }
};

const tenantSettingsSchema = z.object({
  maxMessageSizeBytes: z.number().int().positive().optional(),
}).strict();

const validateSettings = (raw: string): boolean => {
  try {
    const parsed = JSON.parse(raw);
    return tenantSettingsSchema.safeParse(parsed).success;
  } catch {
    return false;
  }
};

const mapTenant = (tenant: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  domains: string;
  settings: string | null;
  enabled: boolean;
}) => {
  const domains = parseDomains(tenant.domains);
  return {
    ...tenant,
    domains: domains ?? [],
  };
};

tenantRoutes.get("/", async (c) => {
  const tenants = await getDb().tenant.findMany({ orderBy: { name: "asc" } });
  return c.json({ data: tenants.map(mapTenant) });
});

tenantRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const tenant = await getDb().tenant.findUnique({
    where: { id },
    include: { _count: { select: { rules: true } } },
  });

  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 404);
  }

  return c.json({ data: mapTenant(tenant) });
});

tenantRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const domainsRaw = typeof body.domains === "string" ? body.domains : "";
  const parsedDomains = parseDomains(domainsRaw);

  if (!name) {
    return c.json({ error: "Name is required" }, 400);
  }
  if (!domainsRaw || !parsedDomains || parsedDomains.length === 0) {
    return c.json({ error: "Domains must be a JSON array string" }, 400);
  }

  if (typeof body.settings === "string" && !validateSettings(body.settings)) {
    return c.json({ error: "Settings must be a valid JSON object. Supported keys: maxMessageSizeBytes (positive integer)" }, 400);
  }
  const tenant = await getDb().tenant.create({
    data: {
      name,
      domains: domainsRaw,
      settings: typeof body.settings === "string" ? body.settings : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    },
  });

  return c.json({ data: mapTenant(tenant) }, 201);
});

tenantRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const data: {
    name?: string;
    domains?: string;
    settings?: string | null;
    enabled?: boolean;
  } = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.domains === "string") {
    const parsed = parseDomains(body.domains);
    if (!parsed || parsed.length === 0) {
      return c.json({ error: "Domains must be a JSON array string" }, 400);
    }
    data.domains = body.domains;
  }
  if (typeof body.settings === "string") {
    if (!validateSettings(body.settings)) {
      return c.json({ error: "Settings must be a valid JSON object. Supported keys: maxMessageSizeBytes (positive integer)" }, 400);
    }
    data.settings = body.settings;
  } else if (body.settings === null) {
    data.settings = null;
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  try {
    const tenant = await getDb().tenant.update({ where: { id }, data });
    return c.json({ data: mapTenant(tenant) });
  } catch {
    return c.json({ error: "Tenant not found" }, 404);
  }
});

tenantRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await getDb().tenant.delete({ where: { id } });
    return c.json({ data: { id } });
  } catch {
    return c.json({ error: "Tenant not found" }, 404);
  }
});
