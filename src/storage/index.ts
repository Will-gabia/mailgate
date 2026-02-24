import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import type { ParsedAttachment } from "../types/index.js";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export async function storeAttachment(
  emailId: string,
  attachment: ParsedAttachment,
  index: number
): Promise<string> {
  const emailDir = join(config.storage.attachmentDir, emailId);
  await mkdir(emailDir, { recursive: true });

  const filename = attachment.filename
    ? sanitizeFilename(attachment.filename)
    : `attachment_${index}`;
  const filePath = join(emailDir, filename);

  await writeFile(filePath, attachment.content);

  logger.debug(
    { emailId, filename, size: attachment.size, path: filePath },
    "Attachment stored to disk"
  );

  return filePath;
}
