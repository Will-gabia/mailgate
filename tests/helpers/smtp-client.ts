import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer/index.js";

export interface SendMailOptions {
  from: string;
  to: string | string[];
  cc?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  attachments?: Mail.Options["attachments"];
  envelope?: Mail.Options["envelope"];
  headers?: Record<string, string>;
}

export async function sendTestEmail(
  options: SendMailOptions
): Promise<nodemailer.SentMessageInfo> {
  const host = process.env.SMTP_HOST ?? "127.0.0.1";
  const port = Number(process.env.SMTP_PORT ?? 9925);

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: false,
  });

  return transport.sendMail({
    from: options.from,
    to: options.to,
    cc: options.cc,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
    envelope: options.envelope,
    headers: options.headers,
  });
}
