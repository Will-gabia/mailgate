import { connectDb, disconnectDb } from "./db/index.js";
import { ruleRepository, tenantRepository } from "./db/index.js";
import type { ClassificationRuleInput, CreateTenantInput } from "./db/repository.js";
import type { TenantSettings } from "./types/index.js";

const ACTIONS = ["forward", "log", "archive", "reject"] as const;
const OPERATORS = ["contains", "notContains", "equals", "startsWith", "endsWith", "regex"] as const;
const FIELDS = ["subject", "from", "to", "cc", "body", "header"] as const;

function printUsage(): void {
  console.log(`
Usage: tsx src/cli.ts <command> [options]

Commands:
  list                          List all classification rules
  show <name>                   Show rule details
  create <name> [options]       Create a new rule
  update <name> [options]       Update an existing rule
  delete <name>                 Delete a rule

  tenant list                   List all tenants
  tenant show <name>            Show tenant details
  tenant create <name> [opts]   Create a new tenant
  tenant update <name> [opts]   Update a tenant
  tenant delete <name>          Delete a tenant

Create/Update Options (rules):
  --priority <number>           Rule priority (higher = checked first)
  --action <action>             Action: ${ACTIONS.join(", ")}
  --forward-to <email>          Forward target (required when action=forward)
  --category <category>         Category tag
  --description <text>          Rule description
  --conditions <json>           Conditions JSON array
  --enabled <true|false>        Enable/disable rule
  --tenant <name>               Associate rule with tenant

Tenant Create/Update Options:
  --domains <json>              Domains JSON array, e.g. '["example.com"]'
  --max-message-size <MB>       Max message size in MB (overrides global default)
  --settings <json>             Optional settings JSON
  --enabled <true|false>        Enable/disable tenant

Conditions Format:
  '[{"field":"subject","operator":"contains","value":"urgent"}]'

  Fields: ${FIELDS.join(", ")}
  Operators: ${OPERATORS.join(", ")}
`.trim());
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        result[key] = value;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}

function validateConditions(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON in --conditions");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("--conditions must be a non-empty JSON array");
  }

  for (const cond of parsed) {
    if (!cond.field || !FIELDS.includes(cond.field)) {
      throw new Error(`Invalid field "${cond.field}". Must be one of: ${FIELDS.join(", ")}`);
    }
    if (!cond.operator || !OPERATORS.includes(cond.operator)) {
      throw new Error(`Invalid operator "${cond.operator}". Must be one of: ${OPERATORS.join(", ")}`);
    }
    if (typeof cond.value !== "string") {
      throw new Error("Each condition must have a string 'value'");
    }
    if (cond.field === "header" && !cond.headerName) {
      throw new Error("Conditions with field 'header' require 'headerName'");
    }
  }

  return raw;
}

function validateDomains(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON in --domains");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("--domains must be a non-empty JSON array of domain strings");
  }

  for (const d of parsed) {
    if (typeof d !== "string" || d.length === 0) {
      throw new Error("Each domain must be a non-empty string");
    }
    if (d.includes("@")) {
      throw new Error(`Domain "${d}" should not contain '@'. Use domain only, e.g. "example.com"`);
    }
  }

  return raw;
}


/**
 * Build tenant settings JSON string from CLI options.
 * If existingSettings is provided (update flow), merges with existing values.
 */
function buildTenantSettings(
  opts: Record<string, string>,
  existingSettings?: string
): string | undefined {
  let settings: TenantSettings = {};

  // Start from existing settings if updating
  if (existingSettings) {
    try {
      settings = JSON.parse(existingSettings) as TenantSettings;
    } catch {
      // ignore invalid existing settings
    }
  }

  // --max-message-size takes priority over raw --settings
  if (opts["max-message-size"]) {
    const sizeMB = parseFloat(opts["max-message-size"]);
    if (isNaN(sizeMB) || sizeMB <= 0) {
      throw new Error("--max-message-size must be a positive number (in MB)");
    }
    settings.maxMessageSizeBytes = Math.round(sizeMB * 1024 * 1024);
  }

  // --settings can set arbitrary JSON (max-message-size still takes priority)
  if (opts.settings) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(opts.settings) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid JSON in --settings");
    }
    settings = { ...raw, ...settings } as TenantSettings;
  }

  if (Object.keys(settings).length === 0) return undefined;
  return JSON.stringify(settings);
}

// --- Rule CLI Functions ---

async function listRules(): Promise<void> {
  const rules = await ruleRepository.findAll();
  if (rules.length === 0) {
    console.log("No rules found.");
    return;
  }

  console.log(`\n${"Name".padEnd(25)} ${"Priority".padEnd(10)} ${"Action".padEnd(10)} ${"Enabled".padEnd(9)} ${"Category".padEnd(15)} Forward To`);
  console.log("-".repeat(100));
  for (const rule of rules) {
    console.log(
      `${rule.name.padEnd(25)} ${String(rule.priority).padEnd(10)} ${rule.action.padEnd(10)} ${String(rule.enabled).padEnd(9)} ${(rule.category ?? "-").padEnd(15)} ${rule.forwardTo ?? "-"}`
    );
  }
  console.log(`\nTotal: ${rules.length} rule(s)`);
}

async function showRule(name: string): Promise<void> {
  const rule = await ruleRepository.findByName(name);
  if (!rule) {
    console.error(`Rule "${name}" not found.`);
    process.exit(1);
  }

  console.log(`\nName:        ${rule.name}`);
  console.log(`ID:          ${rule.id}`);
  console.log(`Description: ${rule.description ?? "-"}`);
  console.log(`Priority:    ${rule.priority}`);
  console.log(`Action:      ${rule.action}`);
  console.log(`Forward To:  ${rule.forwardTo ?? "-"}`);
  console.log(`Category:    ${rule.category ?? "-"}`);
  console.log(`Enabled:     ${rule.enabled}`);
  console.log(`Tenant ID:   ${rule.tenantId ?? "-"}`);
  console.log(`Created:     ${rule.createdAt.toISOString()}`);
  console.log(`Updated:     ${rule.updatedAt.toISOString()}`);
  console.log(`Conditions:`);

  try {
    const conditions = JSON.parse(rule.conditions);
    console.log(JSON.stringify(conditions, null, 2));
  } catch {
    console.log(rule.conditions);
  }
}

async function createRule(name: string, opts: Record<string, string>): Promise<void> {
  if (!opts.conditions) {
    console.error("--conditions is required for create");
    process.exit(1);
  }
  if (!opts.action) {
    console.error("--action is required for create");
    process.exit(1);
  }
  if (!ACTIONS.includes(opts.action as typeof ACTIONS[number])) {
    console.error(`Invalid action "${opts.action}". Must be one of: ${ACTIONS.join(", ")}`);
    process.exit(1);
  }
  if (opts.action === "forward" && !opts["forward-to"]) {
    console.error("--forward-to is required when action=forward");
    process.exit(1);
  }

  const conditions = validateConditions(opts.conditions);

  const existing = await ruleRepository.findByName(name);
  if (existing) {
    console.error(`Rule "${name}" already exists. Use 'update' to modify it.`);
    process.exit(1);
  }

  let tenantId: string | undefined;
  if (opts.tenant) {
    const tenant = await tenantRepository.findByName(opts.tenant);
    if (!tenant) {
      console.error(`Tenant "${opts.tenant}" not found.`);
      process.exit(1);
    }
    tenantId = tenant.id;
  }

  const data: ClassificationRuleInput = {
    name,
    conditions,
    action: opts.action,
    priority: opts.priority ? parseInt(opts.priority, 10) : 0,
    description: opts.description,
    forwardTo: opts["forward-to"],
    category: opts.category,
    enabled: opts.enabled !== "false",
    tenantId,
  };

  const rule = await ruleRepository.create(data);
  console.log(`Rule "${rule.name}" created (id: ${rule.id})`);
}

async function updateRule(name: string, opts: Record<string, string>): Promise<void> {
  const existing = await ruleRepository.findByName(name);
  if (!existing) {
    console.error(`Rule "${name}" not found.`);
    process.exit(1);
  }

  if (opts.action && !ACTIONS.includes(opts.action as typeof ACTIONS[number])) {
    console.error(`Invalid action "${opts.action}". Must be one of: ${ACTIONS.join(", ")}`);
    process.exit(1);
  }

  const data: Partial<Omit<ClassificationRuleInput, "name">> = {};

  if (opts.conditions) {
    data.conditions = validateConditions(opts.conditions);
  }
  if (opts.action) {
    data.action = opts.action;
  }
  if (opts.priority) {
    data.priority = parseInt(opts.priority, 10);
  }
  if (opts.description) {
    data.description = opts.description;
  }
  if (opts["forward-to"]) {
    data.forwardTo = opts["forward-to"];
  }
  if (opts.category) {
    data.category = opts.category;
  }
  if (opts.enabled !== undefined) {
    data.enabled = opts.enabled !== "false";
  }
  if (opts.tenant) {
    const tenant = await tenantRepository.findByName(opts.tenant);
    if (!tenant) {
      console.error(`Tenant "${opts.tenant}" not found.`);
      process.exit(1);
    }
    data.tenantId = tenant.id;
  }

  if (Object.keys(data).length === 0) {
    console.error("No update options provided.");
    process.exit(1);
  }

  await ruleRepository.update(existing.id, data);
  console.log(`Rule "${name}" updated.`);
}

async function deleteRule(name: string): Promise<void> {
  const existing = await ruleRepository.findByName(name);
  if (!existing) {
    console.error(`Rule "${name}" not found.`);
    process.exit(1);
  }

  await ruleRepository.delete(existing.id);
  console.log(`Rule "${name}" deleted.`);
}

// --- Tenant CLI Functions ---

async function listTenants(): Promise<void> {
  const tenants = await tenantRepository.findAll();
  if (tenants.length === 0) {
    console.log("No tenants found.");
    return;
  }

  console.log(`\n${"Name".padEnd(25)} ${"Enabled".padEnd(9)} ${"Domains"}`);
  console.log("-".repeat(80));
  for (const tenant of tenants) {
    let domainsDisplay: string;
    try {
      const domains = JSON.parse(tenant.domains) as string[];
      domainsDisplay = domains.join(", ");
    } catch {
      domainsDisplay = tenant.domains;
    }
    console.log(
      `${tenant.name.padEnd(25)} ${String(tenant.enabled).padEnd(9)} ${domainsDisplay}`
    );
  }
  console.log(`\nTotal: ${tenants.length} tenant(s)`);
}

async function showTenant(name: string): Promise<void> {
  const tenant = await tenantRepository.findByName(name);
  if (!tenant) {
    console.error(`Tenant "${name}" not found.`);
    process.exit(1);
  }

  console.log(`\nName:      ${tenant.name}`);
  console.log(`ID:        ${tenant.id}`);
  console.log(`Enabled:   ${tenant.enabled}`);
  console.log(`Created:   ${tenant.createdAt.toISOString()}`);
  console.log(`Updated:   ${tenant.updatedAt.toISOString()}`);

  console.log(`Domains:`);
  try {
    const domains = JSON.parse(tenant.domains) as string[];
    for (const d of domains) {
      console.log(`  - ${d}`);
    }
  } catch {
    console.log(`  ${tenant.domains}`);
  }

  const maxSize = tenantRepository.getMaxMessageSize(tenant);
  const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
  console.log(`Max Msg:   ${maxSizeMB} MB`);
  if (tenant.settings) {
    console.log(`Settings:`);
    try {
      const settings = JSON.parse(tenant.settings);
      console.log(JSON.stringify(settings, null, 2));
    } catch {
      console.log(`  ${tenant.settings}`);
    }
  }
}

async function createTenant(name: string, opts: Record<string, string>): Promise<void> {
  if (!opts.domains) {
    console.error("--domains is required for tenant create");
    process.exit(1);
  }

  const domains = validateDomains(opts.domains);

  const existing = await tenantRepository.findByName(name);
  if (existing) {
    console.error(`Tenant "${name}" already exists. Use 'tenant update' to modify it.`);
    process.exit(1);
  }

  const settings = buildTenantSettings(opts);
  const data: CreateTenantInput = {
    name,
    domains,
    settings,
    enabled: opts.enabled !== "false",
  };

  const tenant = await tenantRepository.create(data);
  console.log(`Tenant "${tenant.name}" created (id: ${tenant.id})`);
}

async function updateTenant(name: string, opts: Record<string, string>): Promise<void> {
  const existing = await tenantRepository.findByName(name);
  if (!existing) {
    console.error(`Tenant "${name}" not found.`);
    process.exit(1);
  }

  const data: Partial<CreateTenantInput> = {};
  if (opts.domains) {
    data.domains = validateDomains(opts.domains);
  }
  if (opts["max-message-size"] || opts.settings) {
    data.settings = buildTenantSettings(opts, existing.settings ?? undefined);
  }
  if (opts.enabled !== undefined) {
    data.enabled = opts.enabled !== "false";
  }

  if (Object.keys(data).length === 0) {
    console.error("No update options provided.");
    process.exit(1);
  }

  await tenantRepository.update(existing.id, data);
  console.log(`Tenant "${name}" updated.`);
}

async function deleteTenant(name: string): Promise<void> {
  const existing = await tenantRepository.findByName(name);
  if (!existing) {
    console.error(`Tenant "${name}" not found.`);
    process.exit(1);
  }

  await tenantRepository.delete(existing.id);
  console.log(`Tenant "${name}" deleted.`);
}

// --- Main ---

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  await connectDb();

  try {
    switch (command) {
      case "list":
        await listRules();
        break;
      case "show": {
        const name = args[1];
        if (!name) {
          console.error("Usage: show <name>");
          process.exit(1);
        }
        await showRule(name);
        break;
      }
      case "create": {
        const name = args[1];
        if (!name) {
          console.error("Usage: create <name> [options]");
          process.exit(1);
        }
        const opts = parseArgs(args.slice(2));
        await createRule(name, opts);
        break;
      }
      case "update": {
        const name = args[1];
        if (!name) {
          console.error("Usage: update <name> [options]");
          process.exit(1);
        }
        const opts = parseArgs(args.slice(2));
        await updateRule(name, opts);
        break;
      }
      case "delete": {
        const name = args[1];
        if (!name) {
          console.error("Usage: delete <name>");
          process.exit(1);
        }
        await deleteRule(name);
        break;
      }
      case "tenant": {
        const subcommand = args[1];
        if (!subcommand) {
          console.error("Usage: tenant <list|show|create|update|delete> [options]");
          process.exit(1);
        }
        switch (subcommand) {
          case "list":
            await listTenants();
            break;
          case "show": {
            const name = args[2];
            if (!name) {
              console.error("Usage: tenant show <name>");
              process.exit(1);
            }
            await showTenant(name);
            break;
          }
          case "create": {
            const name = args[2];
            if (!name) {
              console.error("Usage: tenant create <name> [options]");
              process.exit(1);
            }
            const opts = parseArgs(args.slice(3));
            await createTenant(name, opts);
            break;
          }
          case "update": {
            const name = args[2];
            if (!name) {
              console.error("Usage: tenant update <name> [options]");
              process.exit(1);
            }
            const opts = parseArgs(args.slice(3));
            await updateTenant(name, opts);
            break;
          }
          case "delete": {
            const name = args[2];
            if (!name) {
              console.error("Usage: tenant delete <name>");
              process.exit(1);
            }
            await deleteTenant(name);
            break;
          }
          default:
            console.error(`Unknown tenant command: ${subcommand}`);
            printUsage();
            process.exit(1);
        }
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error("CLI error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
