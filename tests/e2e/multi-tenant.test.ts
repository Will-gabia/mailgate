import { describe, it, expect } from "vitest";
import { sendTestEmail } from "../helpers/smtp-client.js";
import { getDb } from "../../src/db/index.js";
import { waitForProcessedEmail } from "../helpers/wait-for-email.js";
import type { RuleCondition } from "../../src/types/index.js";

async function createTenant(params: {
  name: string;
  domains: string[];
  enabled?: boolean;
}) {
  const db = getDb();
  return db.tenant.create({
    data: {
      name: params.name,
      domains: JSON.stringify(params.domains),
      enabled: params.enabled ?? true,
    },
  });
}

async function createRule(params: {
  name: string;
  priority: number;
  conditions: RuleCondition[];
  action: string;
  category?: string;
  forwardTo?: string;
  tenantId?: string;
}) {
  const db = getDb();
  return db.classificationRule.create({
    data: {
      name: params.name,
      priority: params.priority,
      conditions: JSON.stringify(params.conditions),
      action: params.action,
      category: params.category,
      forwardTo: params.forwardTo,
      tenantId: params.tenantId,
    },
  });
}

describe("multi-tenant", () => {
  it("tenant-specific rule matches email sent to tenant domain", async () => {
    const tenant = await createTenant({
      name: "acme-corp",
      domains: ["acme.example.com"],
    });

    await createRule({
      name: "acme-urgent",
      priority: 100,
      conditions: [
        { field: "subject", operator: "contains", value: "urgent" },
      ],
      action: "log",
      category: "acme-urgent",
      tenantId: tenant.id,
    });

    const subject = "urgent: acme tenant test";
    await sendTestEmail({
      from: "sender@external.com",
      to: "support@acme.example.com",
      subject,
      text: "This is urgent for acme",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("acme-urgent");
    expect(email.category).toBe("acme-urgent");
    expect(email.tenantId).toBe(tenant.id);
  });

  it("tenant rule does NOT match email sent to a different domain", async () => {
    const tenant = await createTenant({
      name: "beta-inc",
      domains: ["beta.example.com"],
    });

    // Tenant-specific rule — should only trigger for beta.example.com
    await createRule({
      name: "beta-alert",
      priority: 100,
      conditions: [
        { field: "subject", operator: "contains", value: "alert" },
      ],
      action: "log",
      category: "beta-alert",
      tenantId: tenant.id,
    });

    const subject = "alert: not for beta tenant";
    await sendTestEmail({
      from: "sender@external.com",
      to: "someone@other-domain.com",
      subject,
      text: "This alert goes to a non-tenant domain",
    });

    const email = await waitForProcessedEmail(subject);
    // No tenant matched, so tenant rule should NOT apply
    expect(email.matchedRule).toBeNull();
    expect(email.tenantId).toBeNull();
  });

  it("global rule acts as fallback when tenant has no matching tenant-specific rule", async () => {
    const tenant = await createTenant({
      name: "gamma-llc",
      domains: ["gamma.example.com"],
    });

    // Tenant-specific rule that won't match
    await createRule({
      name: "gamma-internal",
      priority: 50,
      conditions: [
        { field: "subject", operator: "contains", value: "internal-only" },
      ],
      action: "log",
      category: "gamma-internal",
      tenantId: tenant.id,
    });

    // Global rule that should match as fallback
    await createRule({
      name: "global-hello",
      priority: 10,
      conditions: [
        { field: "subject", operator: "contains", value: "hello" },
      ],
      action: "log",
      category: "global-hello",
    });

    const subject = "hello from gamma fallback test";
    await sendTestEmail({
      from: "sender@external.com",
      to: "contact@gamma.example.com",
      subject,
      text: "This should match the global rule",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("global-hello");
    expect(email.category).toBe("global-hello");
    expect(email.tenantId).toBe(tenant.id);
  });

  it("unregistered domain uses global rules only", async () => {
    // Create a tenant for a different domain — should not affect this test
    await createTenant({
      name: "delta-co",
      domains: ["delta.example.com"],
    });

    // Tenant-specific rule for delta
    await createRule({
      name: "delta-rule",
      priority: 100,
      conditions: [
        { field: "subject", operator: "contains", value: "info" },
      ],
      action: "log",
      category: "delta-info",
      tenantId: (await getDb().tenant.findUnique({ where: { name: "delta-co" } }))!.id,
    });

    // Global rule
    await createRule({
      name: "global-info",
      priority: 5,
      conditions: [
        { field: "subject", operator: "contains", value: "info" },
      ],
      action: "log",
      category: "global-info",
    });

    const subject = "info: unregistered domain test";
    await sendTestEmail({
      from: "sender@external.com",
      to: "user@unknown-domain.com",
      subject,
      text: "No tenant should match",
    });

    const email = await waitForProcessedEmail(subject);
    // No tenant matched, so only global rules apply
    expect(email.matchedRule).toBe("global-info");
    expect(email.category).toBe("global-info");
    expect(email.tenantId).toBeNull();
  });
});
