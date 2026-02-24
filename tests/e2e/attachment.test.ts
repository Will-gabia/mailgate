import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sendTestEmail } from "../helpers/smtp-client.js";
import { waitForProcessedEmail } from "../helpers/wait-for-email.js";
import { config } from "../../src/config/index.js";

describe("attachments", () => {
  it("stores attachment checksum and metadata", async () => {
    const content = Buffer.from("hello attachment");
    const checksum = createHash("sha256").update(content).digest("hex");

    const subject = "Attachment Single";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "with attachment",
      attachments: [
        {
          filename: "note.txt",
          content,
          contentType: "text/plain",
        },
      ],
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.attachments.length).toBe(1);
    const attachment = email.attachments[0];
    expect(attachment.filename).toBe("note.txt");
    expect(attachment.contentType).toBe("text/plain");
    expect(attachment.size).toBe(content.length);
    expect(attachment.checksum).toBe(checksum);
    expect(attachment.storagePath).toBeTruthy();
    expect(existsSync(attachment.storagePath!)).toBe(true);
    const stored = readFileSync(attachment.storagePath!);
    expect(stored.toString()).toBe("hello attachment");
  });

  it("stores multiple attachments", async () => {
    const subject = "Attachment Multiple";
    await sendTestEmail({
      from: "sender@example.com",
      to: "receiver@example.com",
      subject,
      text: "with attachments",
      attachments: [
        {
          filename: "a.txt",
          content: Buffer.from("A"),
          contentType: "text/plain",
        },
        {
          filename: "b.txt",
          content: Buffer.from("B"),
          contentType: "text/plain",
        },
      ],
    });

    const email = await waitForProcessedEmail(subject);
    expect(email.attachments.length).toBe(2);
    for (const att of email.attachments) {
      expect(att.storagePath).toBeTruthy();
      expect(existsSync(att.storagePath!)).toBe(true);
    }

    // Verify files are in emailId subdirectory
    const emailDir = join(config.storage.attachmentDir, email.id);
    expect(existsSync(emailDir)).toBe(true);
  });
});
