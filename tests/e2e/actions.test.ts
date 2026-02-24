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
}) {
  const db = getDb();
  return db.classificationRule.create({
    data: {
      name: params.name,
      priority: params.priority,
      conditions: JSON.stringify(params.conditions),
      action: params.action,
    },
  });
}

describe("actions", () => {
  it("archive action sets status archived", async () => {
    await createRule({
      name: "archive-rule",
      priority: 10,
      conditions: [{ field: "subject", operator: "contains", value: "archive" }],
      action: "archive",
    });

    const subject = "archive this";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "archive me",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.status).toBe("archived");
  });

  it("reject action sets status archived", async () => {
    await createRule({
      name: "reject-rule",
      priority: 10,
      conditions: [{ field: "subject", operator: "contains", value: "reject" }],
      action: "reject",
    });

    const subject = "reject this";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "reject me",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.status).toBe("archived");
  });

  it("log action keeps status classified", async () => {
    await createRule({
      name: "log-rule",
      priority: 10,
      conditions: [{ field: "subject", operator: "contains", value: "logaction" }],
      action: "log",
    });

    const subject = "logaction this";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "log me",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.status).toBe("classified");
  });

  it("stores multiple recipients as comma-separated rcptTo", async () => {
    const subject = "multi rcpt";
    await sendTestEmail({
      from: "sender@example.com",
      to: ["a@example.com", "b@example.com"],
      subject,
      text: "multi",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.rcptTo).toContain("a@example.com");
    expect(email.rcptTo).toContain("b@example.com");
  });
});
