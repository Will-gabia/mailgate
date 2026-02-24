import { describe, it, expect } from "vitest";
import { sendTestEmail } from "../helpers/smtp-client.js";
import { getDb } from "../../src/db/index.js";
import { waitForProcessedEmail } from "../helpers/wait-for-email.js";
import type { RuleCondition } from "../../src/types/index.js";

async function createRule(params: {
  name: string;
  priority: number;
  conditions: RuleCondition[];
  action: string;
  category?: string;
  forwardTo?: string;
  matchMode?: string;
  enabled?: boolean;
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
      matchMode: params.matchMode,
      enabled: params.enabled,
    },
  });
}

describe("classification", () => {
  it("matches subject contains rule", async () => {
    await createRule({
      name: "urgent-subject",
      priority: 10,
      conditions: [{ field: "subject", operator: "contains", value: "urgent" }],
      action: "log",
      category: "urgent",
    });

    const subject = "urgent: please review";
    await sendTestEmail({
      from: "alerts@example.com",
      to: "ops@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("urgent-subject");
    expect(email.category).toBe("urgent");
  });

  it("matches from endsWith rule", async () => {
    await createRule({
      name: "from-domain",
      priority: 5,
      conditions: [{ field: "from", operator: "endsWith", value: "@test.com" }],
      action: "log",
      category: "domain",
    });

    const subject = "domain match";
    await sendTestEmail({
      from: "user@test.com",
      to: "ops@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("from-domain");
  });

  it("matches subject regex rule", async () => {
    await createRule({
      name: "regex-alert",
      priority: 8,
      conditions: [
        { field: "subject", operator: "regex", value: "^\\[ALERT\\]" },
      ],
      action: "log",
      category: "alert",
    });

    const subject = "[ALERT] Disk";
    await sendTestEmail({
      from: "alert@example.com",
      to: "ops@example.com",
      subject,
      text: "disk",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("regex-alert");
  });

  it("matches highest priority rule first", async () => {
    await createRule({
      name: "low-priority",
      priority: 1,
      conditions: [{ field: "subject", operator: "contains", value: "hello" }],
      action: "log",
      category: "low",
    });
    await createRule({
      name: "high-priority",
      priority: 100,
      conditions: [{ field: "subject", operator: "contains", value: "hello" }],
      action: "log",
      category: "high",
    });

    const subject = "hello there";
    await sendTestEmail({
      from: "priority@example.com",
      to: "ops@example.com",
      subject,
      text: "hello",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("high-priority");
    expect(email.category).toBe("high");
  });

  it("no matching rule leaves email classified without matchedRule", async () => {
    const subject = "no match";
    await sendTestEmail({
      from: "none@example.com",
      to: "ops@example.com",
      subject,
      text: "nothing",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.status).toBe("classified");
    expect(email.matchedRule).toBeNull();
  });

  it("matches to field contains rule", async () => {
    await createRule({
      name: "to-field-rule",
      priority: 10,
      conditions: [{ field: "to", operator: "contains", value: "ops" }],
      action: "log",
      category: "to-match",
    });

    const subject = "to field match test";
    await sendTestEmail({
      from: "sender@example.com",
      to: "ops@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("to-field-rule");
    expect(email.category).toBe("to-match");
  });

  it("matches cc field contains rule", async () => {
    await createRule({
      name: "cc-field-rule",
      priority: 10,
      conditions: [{ field: "cc", operator: "contains", value: "manager" }],
      action: "log",
      category: "cc-match",
    });

    const subject = "cc field match test";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      cc: "manager@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("cc-field-rule");
    expect(email.category).toBe("cc-match");
  });

  it("matches body contains rule", async () => {
    await createRule({
      name: "body-payment-rule",
      priority: 10,
      conditions: [{ field: "body", operator: "contains", value: "payment" }],
      action: "log",
      category: "body-match",
    });

    const subject = "body field match test";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "Your payment is confirmed",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("body-payment-rule");
    expect(email.category).toBe("body-match");
  });

  it("matches header field rule", async () => {
    await createRule({
      name: "header-custom-rule",
      priority: 10,
      conditions: [
        { field: "header", operator: "contains", value: "urgent", headerName: "x-custom-tag" },
      ],
      action: "log",
      category: "header-match",
    });
    const subject = "header field match test";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "important",
      headers: { "X-Custom-Tag": "urgent" },
    });
    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("header-custom-rule");
    expect(email.category).toBe("header-match");
  });

  it("matches subject equals rule", async () => {
    await createRule({
      name: "equals-rule",
      priority: 10,
      conditions: [{ field: "subject", operator: "equals", value: "exact match test" }],
      action: "log",
      category: "equals-match",
    });

    const subject = "exact match test";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("equals-rule");
    expect(email.category).toBe("equals-match");
  });

  it("matches subject startsWith rule", async () => {
    await createRule({
      name: "starts-with-rule",
      priority: 10,
      conditions: [{ field: "subject", operator: "startsWith", value: "[notice]" }],
      action: "log",
      category: "starts-match",
    });

    const subject = "[NOTICE] scheduled maintenance";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("starts-with-rule");
    expect(email.category).toBe("starts-match");
  });

  it("matches subject notContains rule", async () => {
    await createRule({
      name: "not-contains-rule",
      priority: 10,
      conditions: [{ field: "subject", operator: "notContains", value: "spam" }],
      action: "log",
      category: "not-contains-match",
    });

    const subject = "important update notcontains";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("not-contains-rule");
    expect(email.category).toBe("not-contains-match");
  });

  it("matches when matchMode is any and one condition is met", async () => {
    await createRule({
      name: "any-mode-rule",
      priority: 10,
      conditions: [
        { field: "subject", operator: "contains", value: "matchany-cond1" },
        { field: "from", operator: "contains", value: "matchany-cond2" },
      ],
      action: "log",
      category: "any-mode",
      matchMode: "any",
    });

    const subject = "matchany-cond1 testing";
    await sendTestEmail({
      from: "unrelated@example.com",
      to: "receiver@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBe("any-mode-rule");
    expect(email.category).toBe("any-mode");
  });

  it("does not match when matchMode is all and only one condition is met", async () => {
    await createRule({
      name: "all-mode-rule",
      priority: 10,
      conditions: [
        { field: "subject", operator: "contains", value: "matchall-cond1" },
        { field: "from", operator: "contains", value: "matchall-cond2" },
      ],
      action: "log",
      category: "all-mode",
    });

    const subject = "matchall-cond1 testing";
    await sendTestEmail({
      from: "unrelated@example.com",
      to: "receiver@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBeNull();
  });

  it("skips disabled rules", async () => {
    await createRule({
      name: "disabled-rule",
      priority: 100,
      conditions: [{ field: "subject", operator: "contains", value: "disabled-test" }],
      action: "log",
      category: "disabled",
      enabled: false,
    });

    const subject = "disabled-test should not match";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.matchedRule).toBeNull();
  });

  it("skips rules with malformed conditions JSON", async () => {
    const db = getDb();
    await db.classificationRule.create({
      data: {
        name: "malformed-rule",
        priority: 100,
        conditions: "not valid json[",
        action: "log",
      },
    });

    const subject = "malformed conditions test";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "ping",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.status).toBeDefined();
    expect(email.matchedRule).toBeNull();
  });
});
