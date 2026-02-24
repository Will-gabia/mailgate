import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer/index.js";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { forwardLogRepository } from "../db/index.js";
import type { ParsedEmail } from "../types/index.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (!config.relay.host) {
      throw new Error("Relay SMTP host is not configured");
    }

    transporter = nodemailer.createTransport({
      host: config.relay.host,
      port: config.relay.port,
      secure: config.relay.secure,
      auth: config.relay.auth,
    });
  }
  return transporter;
}

export async function forwardEmail(
  email: ParsedEmail,
  emailId: string,
  forwardTo: string
): Promise<boolean> {
  const recipients = forwardTo.split(",").map((r) => r.trim());

  const mailOptions: Mail.Options = {
    from: email.from,
    to: recipients,
    subject: email.subject ? `[Fwd] ${email.subject}` : "[Forwarded]",
    text: email.textBody,
    html: email.htmlBody,
    attachments: email.attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
    headers: {
      "X-Forwarded-By": "mail-gateway",
      "X-Original-From": email.from || "unknown",
    },
  };

  for (const recipient of recipients) {
    try {
      const info = await getTransporter().sendMail({
        ...mailOptions,
        to: recipient,
      });

      await forwardLogRepository.create({
        emailId,
        forwardTo: recipient,
        status: "success",
        smtpResponse: info.response,
      });

      logger.info(
        { emailId, recipient, response: info.response },
        "Email forwarded"
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";

      await forwardLogRepository.create({
        emailId,
        forwardTo: recipient,
        status: "failed",
        error: errorMessage,
        nextRetryAt: new Date(Date.now() + 60000), // First retry in 1 minute
      });

      logger.error(
        { emailId, recipient, error: errorMessage },
        "Failed to forward email"
      );
      return false;
    }
  }

  return true;
}

export async function verifyTransport(): Promise<boolean> {
  try {
    if (!config.relay.host) {
      logger.warn("Relay SMTP not configured, forwarding disabled");
      return false;
    }
    await getTransporter().verify();
    logger.info("Relay SMTP transport verified");
    return true;
  } catch (err) {
    logger.warn({ error: err }, "Relay SMTP verification failed");
    return false;
  }
}

export function resetTransporter(): void {
  transporter = null;
}
