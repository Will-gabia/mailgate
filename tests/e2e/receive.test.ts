import { describe, it, expect } from "vitest";
import { sendTestEmail } from "../helpers/smtp-client.js";
import { waitForProcessedEmail } from "../helpers/wait-for-email.js";

describe("receive pipeline", () => {
  it("stores plain text email with envelope fields", async () => {
    const subject = "Receive Plain Text";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "hello world",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.mailFrom).toBe("sender@example.com");
    expect(email.rcptTo).toBe("receiver@example.com");
    expect(email.subject).toBe(subject);
    expect(email.textBody?.trim()).toBe("hello world");
    expect(email.status).toBeDefined();
    expect(email.rawMessage).toContain("hello world");
  });

  it("stores html body when provided", async () => {
    const subject = "Receive HTML";
    await sendTestEmail({
      from: "html@example.com",
      to: "receiver@example.com",
      subject,
      html: "<p><strong>hello</strong></p>",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.htmlBody).toContain("<strong>hello</strong>");
  });

  it("stores raw message", async () => {
    const subject = "Raw Message Stored";
    await sendTestEmail({
      from: "raw@example.com",
      to: "receiver@example.com",
      subject,
      text: "raw body",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.rawMessage).toContain("raw body");
  });

  it("stores parsed header fields (messageId, fromHeader, toHeader)", async () => {
    const subject = "Header Fields Storage Test";
    await sendTestEmail({
      from: "headersender@example.com",
      to: "headerreceiver@example.com",
      subject,
      text: "header fields test",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.messageId).toBeDefined();
    expect(email.fromHeader).toContain("headersender@example.com");
    expect(email.toHeader).toContain("headerreceiver@example.com");
  });

  it("stores ccHeader when CC is present", async () => {
    const subject = "CC Header Storage Test";
    await sendTestEmail({
      from: "ccsender@example.com",
      to: "ccreceiver@example.com",
      cc: "ccmanager@example.com",
      subject,
      text: "cc header test",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.ccHeader).toContain("ccmanager@example.com");
  });

  it("extracts keywords from email body", async () => {
    const subject = "Keywords Extraction Test";
    await sendTestEmail({
      from: "keywords@example.com",
      to: "receiver@example.com",
      subject,
      text: "The payment confirmation has been processed. Please review the payment details and confirm the receipt of payment.",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.keywords).toBeDefined();
    const keywords = JSON.parse(email.keywords!) as string[];
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.some((k: string) => k.toLowerCase() === "payment")).toBe(true);
  });

  it("stores dkimResult and spfResult as none for test environment", async () => {
    const subject = "Auth Result Fallback Test";
    await sendTestEmail({
      from: "authtest@example.com",
      to: "receiver@example.com",
      subject,
      text: "auth fallback test",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.dkimResult).toBe("none");
    expect(email.spfResult).toBe("none");
  });
});
