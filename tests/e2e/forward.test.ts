import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sendTestEmail } from "../helpers/smtp-client.js";
import { createCaptureServer } from "../helpers/capture-server.js";
import { getDb } from "../../src/db/index.js";
import { resetTransporter } from "../../src/forwarder/index.js";
import { waitForProcessedEmail } from "../helpers/wait-for-email.js";
import type { RuleCondition } from "../../src/types/index.js";

async function createRule(params: {
  name: string;
  priority: number;
  conditions: RuleCondition[];
  action: string;
  forwardTo?: string;
}) {
  const db = getDb();
  return db.classificationRule.create({
    data: {
      name: params.name,
      priority: params.priority,
      conditions: JSON.stringify(params.conditions),
      action: params.action,
      forwardTo: params.forwardTo,
    },
  });
}

const relayHost = process.env.RELAY_SMTP_HOST ?? "127.0.0.1";
const relayPort = Number(process.env.RELAY_SMTP_PORT ?? 9926);

describe("forwarding", () => {
  let capture = createCaptureServer(relayHost, relayPort);

  beforeAll(async () => {
    await capture.start();
  });

  afterAll(async () => {
    await capture.stop();
  });

  it("forwards matching email and logs success", async () => {
    resetTransporter();
    await createRule({
      name: "forward-ops",
      priority: 50,
      conditions: [{ field: "subject", operator: "contains", value: "forward" }],
      action: "forward",
      forwardTo: "ops@example.com",
    });

    const subject = "forward this";
    await sendTestEmail({
      from: "sender@example.com",
      to: "gateway@example.com",
      subject,
      text: "please forward",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.status).toBe("forwarded");

    const logs = await getDb().forwardLog.findMany({
      where: { emailId: email.id },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe("success");

    const received = capture.messages.find((msg) => msg.raw.includes(subject));
    expect(received).toBeDefined();
  });

  it("logs failure when relay is unavailable", async () => {
    resetTransporter();
    await createRule({
      name: "forward-fail",
      priority: 60,
      conditions: [{ field: "subject", operator: "contains", value: "failfwd" }],
      action: "forward",
      forwardTo: "ops@example.com",
    });

    await capture.stop();

    const subject = "failfwd this";
    await sendTestEmail({
      from: "sender@example.com",
      to: "gateway@example.com",
      subject,
      text: "please forward",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.status).toBe("failed");

    const logs = await getDb().forwardLog.findMany({
      where: { emailId: email.id },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe("failed");

    // Create a fresh capture server to avoid "421 Server shutting down" from the old instance
    capture = createCaptureServer(relayHost, relayPort);
    await capture.start();
    resetTransporter();
  });

  it("forwards to multiple recipients via comma-separated forwardTo", async () => {
    resetTransporter();
    await createRule({
      name: "forward-multi",
      priority: 70,
      conditions: [
        { field: "subject", operator: "contains", value: "multi-fwd" },
      ],
      action: "forward",
      forwardTo: "a@example.com,b@example.com",
    });

    const subject = "multi-fwd recipients";
    await sendTestEmail({
      from: "sender@example.com",
      to: "gateway@example.com",
      subject,
      text: "please forward to many",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.status).toBe("forwarded");

    const logs = await getDb().forwardLog.findMany({
      where: { emailId: email.id },
    });
    expect(logs.length).toBe(2);
    expect(logs.every((log) => log.status === "success")).toBe(true);

    const rawMessages = capture.messages.map((msg) => msg.raw);
    expect(rawMessages.some((raw) => raw.includes("a@example.com"))).toBe(
      true,
    );
    expect(rawMessages.some((raw) => raw.includes("b@example.com"))).toBe(
      true,
    );
  });

  it("sets failed status when forward rule has no forwardTo", async () => {
    resetTransporter();
    await createRule({
      name: "forward-missing-target",
      priority: 80,
      conditions: [
        { field: "subject", operator: "contains", value: "nofwd-target" },
      ],
      action: "forward",
    });

    const subject = "nofwd-target here";
    await sendTestEmail({
      from: "sender@example.com",
      to: "gateway@example.com",
      subject,
      text: "please forward anyway",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.status).toBe("failed");
  });

  it("forwarded email contains [Fwd] prefix and X-Forwarded-By header", async () => {
    resetTransporter();
    await createRule({
      name: "forward-metadata",
      priority: 90,
      conditions: [{ field: "subject", operator: "contains", value: "fwd-meta" }],
      action: "forward",
      forwardTo: "verify@example.com",
    });

    const subject = "fwd-meta check";
    await sendTestEmail({
      from: "sender@example.com",
      to: "gateway@example.com",
      subject,
      text: "verify headers",
    });

    await waitForProcessedEmail(subject);

    const received = capture.messages.find((msg) =>
      msg.raw.includes("fwd-meta"),
    );
    expect(received).toBeDefined();
    expect(received?.raw).toContain("[Fwd] fwd-meta check");
    expect(received?.raw).toContain("X-Forwarded-By: mail-gateway");
    expect(received?.raw).toContain("X-Original-From");
  });
});
