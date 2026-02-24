import { simpleParser, type ParsedMail } from "mailparser";
import { createHash } from "crypto";
import type { ParsedEmail, ParsedAttachment } from "../types/index.js";

function addressToString(
  addr: ParsedMail["from"]
): string | undefined {
  if (!addr) return undefined;
  return addr.value
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
    .join(", ");
}

function addressListToString(
  addr: ParsedMail["to"]
): string | undefined {
  if (!addr) return undefined;
  if (Array.isArray(addr)) {
    return addr
      .flatMap((a) =>
        a.value.map((v) => (v.name ? `${v.name} <${v.address}>` : v.address))
      )
      .join(", ");
  }
  return addr.value
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
    .join(", ");
}

export async function parseEmail(rawMessage: string): Promise<ParsedEmail> {
  const parsed = await simpleParser(rawMessage);

  const headers: Record<string, string> = {};
  parsed.headers.forEach((value, key) => {
    headers[key] = typeof value === "string" ? value : JSON.stringify(value);
  });

  const attachments: ParsedAttachment[] = (parsed.attachments || []).map(
    (att) => ({
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
      content: att.content,
      checksum: createHash("sha256").update(att.content).digest("hex"),
    })
  );

  return {
    messageId: parsed.messageId,
    subject: parsed.subject,
    from: addressToString(parsed.from),
    to: addressListToString(parsed.to),
    cc: addressListToString(parsed.cc),
    replyTo: parsed.replyTo ? addressListToString(parsed.replyTo) : undefined,
    date: parsed.date,
    headers,
    textBody: parsed.text,
    htmlBody: parsed.html || undefined,
    attachments,
    rawMessage,
  };
}
