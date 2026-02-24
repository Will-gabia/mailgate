import { describe, it, expect } from "vitest";
import { sendTestEmail } from "../helpers/smtp-client.js";
import { getDb } from "../../src/db/index.js";
import { waitForProcessedEmail } from "../helpers/wait-for-email.js";
import type { TenantSettings } from "../../src/types/index.js";

async function createTenantWithSizeLimit(params: {
  name: string;
  domains: string[];
  maxMessageSizeBytes?: number;
}) {
  const db = getDb();
  const settings: TenantSettings = {};
  if (params.maxMessageSizeBytes !== undefined) {
    settings.maxMessageSizeBytes = params.maxMessageSizeBytes;
  }
  return db.tenant.create({
    data: {
      name: params.name,
      domains: JSON.stringify(params.domains),
      enabled: true,
      settings:
        Object.keys(settings).length > 0
          ? JSON.stringify(settings)
          : null,
    },
  });
}

describe("message-size-limit", () => {
  it("accepts email within the tenant size limit", async () => {
    await createTenantWithSizeLimit({
      name: "size-ok-tenant",
      domains: ["sizeok.example.com"],
      maxMessageSizeBytes: 1024 * 1024, // 1 MB
    });

    const subject = "size-ok: within limit";
    await sendTestEmail({
      from: "sender@external.com",
      to: "user@sizeok.example.com",
      subject,
      text: "This is a small email that should be accepted.",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email).toBeDefined();
    expect(email.tenantId).toBeTruthy();
  });

  it("rejects email exceeding the tenant size limit", async () => {
    // Set a very small limit (1 KB) to force rejection
    await createTenantWithSizeLimit({
      name: "size-reject-tenant",
      domains: ["sizereject.example.com"],
      maxMessageSizeBytes: 1024, // 1 KB
    });

    // Generate a body larger than 1 KB
    const largeBody = "X".repeat(2048);

    await expect(
      sendTestEmail({
        from: "sender@external.com",
        to: "user@sizereject.example.com",
        subject: "size-reject: too large",
        text: largeBody,
      })
    ).rejects.toThrow();
  });

  it("uses global limit when tenant has no size override", async () => {
    // Create tenant without size setting — should use global (25 MB default)
    await createTenantWithSizeLimit({
      name: "size-global-tenant",
      domains: ["sizeglobal.example.com"],
    });

    const subject = "size-global: normal email";
    await sendTestEmail({
      from: "sender@external.com",
      to: "user@sizeglobal.example.com",
      subject,
      text: "Normal sized email, should be fine with global limit.",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email).toBeDefined();
    expect(email.tenantId).toBeTruthy();
  });

  it("uses global limit for emails to unregistered domains", async () => {
    const subject = "size-noreg: no tenant";
    await sendTestEmail({
      from: "sender@external.com",
      to: "user@no-tenant.example.com",
      subject,
      text: "No tenant for this domain, global limit applies.",
    });

    const email = await waitForProcessedEmail(subject);
    expect(email).toBeDefined();
    expect(email.tenantId).toBeNull();
  });
});
