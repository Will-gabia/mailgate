import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { EMAIL_QUEUE_NAME } from "./email-queue.js";
import { logger } from "../config/logger.js";
import { emailRepository, attachmentRepository, tenantRepository } from "../db/index.js";
import { parseEmail } from "../parser/index.js";
import { classifyEmail } from "../classifier/index.js";
import { forwardEmail } from "../forwarder/index.js";
import { storeAttachment } from "../storage/index.js";
import { verifyEmailAuth } from "../auth/index.js";
import { extractKeywords } from "../keyword/index.js";

export interface EmailJobData {
  emailId: string;
}

/**
 * Process an email job: parse → auth → classify → forward → update status.
 * Uses DB checkpoints so that on retry, already-completed steps are skipped.
 */
async function processEmail(job: Job<EmailJobData>): Promise<void> {
  const { emailId } = job.data;

  const email = await emailRepository.findById(emailId);
  if (!email) {
    logger.warn({ emailId }, "Email not found, skipping job");
    return;
  }

  // If already processed (not 'received'), skip — idempotency guard
  if (email.status !== "received") {
    logger.debug({ emailId, status: email.status }, "Email already processed, skipping");
    return;
  }

  const rawMessage = email.rawMessage;
  const mailFrom = email.mailFrom;
  const rcptTo = email.rcptTo.split(", ");
  const remoteIp = email.remoteIp;

  // Parse
  const parsed = await parseEmail(rawMessage);

  // DKIM/SPF verification and keyword extraction (parallel)
  const [authResult, keywords] = await Promise.all([
    verifyEmailAuth(rawMessage, remoteIp, mailFrom),
    Promise.resolve(extractKeywords(parsed.textBody, parsed.htmlBody)),
  ]);

  // Multi-tenant: extract domain from first rcptTo and look up tenant
  let tenantId: string | undefined = email.tenantId ?? undefined;
  if (!tenantId && rcptTo.length > 0) {
    const firstRecipient = rcptTo[0];
    const domain = firstRecipient.split("@")[1];
    if (domain) {
      const tenant = await tenantRepository.findByDomain(domain);
      if (tenant) {
        tenantId = tenant.id;
        logger.debug({ domain, tenantId, tenantName: tenant.name }, "Tenant matched");
      }
    }
  }

  // Update parsed fields + auth results on the email record
  await emailRepository.updateParsedFields(emailId, {
    messageId: parsed.messageId,
    subject: parsed.subject,
    fromHeader: parsed.from,
    toHeader: parsed.to,
    ccHeader: parsed.cc,
    replyTo: parsed.replyTo,
    date: parsed.date,
    headers: JSON.stringify(parsed.headers),
    textBody: parsed.textBody,
    htmlBody: parsed.htmlBody,
    tenantId,
    dkimResult: authResult.dkim,
    spfResult: authResult.spf,
    keywords: keywords.length > 0 ? JSON.stringify(keywords) : undefined,
  });

  // Store attachments
  for (let i = 0; i < parsed.attachments.length; i++) {
    const att = parsed.attachments[i];
    const storagePath = await storeAttachment(emailId, att, i);
    await attachmentRepository.create({
      emailId,
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
      checksum: att.checksum,
      storagePath,
    });
  }

  // Classify
  const result = await classifyEmail(parsed, tenantId);

  let finalStatus = "classified";

  if (result.matched) {
    switch (result.action) {
      case "forward":
        if (result.forwardTo) {
          const success = await forwardEmail(
            parsed,
            emailId,
            result.forwardTo,
          );
          finalStatus = success ? "forwarded" : "failed";
        } else {
          logger.warn(
            { ruleName: result.ruleName },
            "Forward rule matched but no forwardTo configured",
          );
          finalStatus = "failed";
        }
        break;
      case "archive":
        finalStatus = "archived";
        break;
      case "reject":
        finalStatus = "archived";
        logger.info({ emailId }, "Email rejected by rule");
        break;
      case "log":
      default:
        finalStatus = "classified";
        break;
    }
  }

  await emailRepository.updateStatus(emailId, finalStatus, {
    category: result.category,
    matchedRule: result.ruleName,
  });

  logger.info(
    {
      emailId,
      subject: parsed.subject,
      from: parsed.from,
      status: finalStatus,
      rule: result.ruleName,
    },
    "Email processed",
  );
}

let worker: Worker<EmailJobData> | undefined;

/**
 * Start the BullMQ email processing worker.
 */
export function startEmailWorker(): Worker<EmailJobData> {
  if (worker) {
    logger.warn("Email worker already running");
    return worker;
  }

  worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmail, {
    connection: getRedisConnection(),
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id, emailId: job.data.emailId }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, emailId: job?.data.emailId, error: err.message, attempts: job?.attemptsMade },
      "Job failed",
    );
  });

  worker.on("error", (err) => {
    logger.error({ error: err }, "Worker error");
  });

  logger.info("Email processing worker started");
  return worker;
}

/**
 * Stop the BullMQ email processing worker gracefully.
 */
export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
    logger.info("Email processing worker stopped");
  }
}