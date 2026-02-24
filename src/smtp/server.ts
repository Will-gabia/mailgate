import { SMTPServer, type SMTPServerOptions } from "smtp-server";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { emailRepository, tenantRepository } from "../db/index.js";
import { checkRateLimit } from "../rate-limiter/index.js";
import { addEmailJob } from "../queue/index.js";

export function isIpAllowed(remoteIp: string): boolean {
  const cleanIp = remoteIp.replace(/^::ffff:/, "");
  return config.smtp.allowedIps.some((allowed) => {
    const cleanAllowed = allowed.replace(/^::ffff:/, "");
    if (cleanAllowed.includes("/")) {
      return matchCidr(cleanIp, cleanAllowed);
    }
    return cleanIp === cleanAllowed;
  });
}

function matchCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = parseInt(bits, 10);
  if (isNaN(mask)) return false;

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  if (ipNum === null || rangeNum === null) return false;

  const maskBits = ~(2 ** (32 - mask) - 1);
  return (ipNum & maskBits) === (rangeNum & maskBits);
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some(isNaN)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

/**
 * Enqueue-only handler: save raw message + envelope to DB as 'received',
 * enqueue a BullMQ job, and return immediately.
 * Processing (parse → auth → classify → forward) happens in the worker.
 */
async function handleMessage(
  rawMessage: string,
  mailFrom: string,
  rcptTo: string[],
  remoteIp: string
): Promise<void> {
  // Multi-tenant: extract domain from first rcptTo and look up tenant
  let tenantId: string | undefined;
  if (rcptTo.length > 0) {
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

  // Save minimal envelope + raw message to DB as 'received'
  const emailRecord = await emailRepository.create({
    mailFrom,
    rcptTo: rcptTo.join(", "),
    remoteIp,
    rawMessage,
    tenantId,
  });

  // Enqueue for async processing — if this fails, SMTP returns 451
  await addEmailJob(emailRecord.id);
  logger.info(
    { emailId: emailRecord.id, mailFrom, rcptTo },
    "Email received and enqueued",
  );
}

export function createSmtpServer(): SMTPServer {
  const tlsEnabled = config.smtp.tls.enabled;
  const options: SMTPServerOptions = {
    authOptional: true,
    disabledCommands: tlsEnabled ? [] : ["STARTTLS"],
    banner: "Mail Gateway SMTP Server",
    size: config.messageSize.maxBytes,
    ...(tlsEnabled && config.smtp.tls.key && config.smtp.tls.cert
      ? {
          key: config.smtp.tls.key,
          cert: config.smtp.tls.cert,
          ...(config.smtp.tls.ca ? { ca: config.smtp.tls.ca } : {}),
        }
      : {}),

    onConnect(session, callback) {
      const remoteIp = session.remoteAddress;
      if (!isIpAllowed(remoteIp)) {
        logger.warn({ remoteIp }, "Connection rejected: IP not allowed");
        return callback(new Error("Connection not allowed from your IP"));
      }

      const rateLimitResult = checkRateLimit(remoteIp);
      if (!rateLimitResult.allowed) {
        logger.warn(
          {
            remoteIp,
            remaining: rateLimitResult.remaining,
            resetAt: new Date(rateLimitResult.resetAt).toISOString(),
          },
          "Connection rejected: rate limit exceeded"
        );
        return callback(
          new Error("Too many connections, please try again later")
        );
      }
      logger.debug({ remoteIp }, "SMTP connection accepted");
      callback();
    },

    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      let sizeLimitExceeded = false;

      // Resolve per-tenant size limit before reading data
      const rcptTo = session.envelope.rcptTo.map((r) => r.address);
      const firstRecipient = rcptTo[0];
      const domain = firstRecipient?.split("@")[1];

      const sizeLimitPromise = (async () => {
        if (!domain) return config.messageSize.maxBytes;
        const tenant = await tenantRepository.findByDomain(domain);
        if (!tenant) return config.messageSize.maxBytes;
        return tenantRepository.getMaxMessageSize(tenant);
      })();

      // We need to start reading immediately, so resolve limit in parallel
      let maxSize = config.messageSize.maxBytes;
      sizeLimitPromise.then((limit) => {
        maxSize = limit;
        // Re-check in case data already exceeded tenant-specific limit
        if (totalSize > maxSize) {
          sizeLimitExceeded = true;
          stream.removeAllListeners("data");
          const limitMB = (maxSize / (1024 * 1024)).toFixed(1);
          logger.warn(
            { totalSize, maxSize, domain },
            "Message size limit exceeded"
          );
          callback(
            new Error(`Message exceeds size limit of ${limitMB} MB`)
          );
        }
      });
      stream.on("data", (chunk: Buffer) => {
        if (sizeLimitExceeded) return;
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          sizeLimitExceeded = true;
          stream.removeAllListeners("data");
          const limitMB = (maxSize / (1024 * 1024)).toFixed(1);
          logger.warn(
            { totalSize, maxSize, domain },
            "Message size limit exceeded"
          );
          callback(
            new Error(`Message exceeds size limit of ${limitMB} MB`)
          );
          return;
        }
        chunks.push(chunk);
      });
      stream.on("end", () => {
        if (sizeLimitExceeded) return;
        const rawMessage = Buffer.concat(chunks).toString("utf-8");
        const mailFrom = session.envelope.mailFrom
          ? session.envelope.mailFrom.address
          : "unknown";
        const remoteIp = session.remoteAddress;
        handleMessage(rawMessage, mailFrom, rcptTo, remoteIp)
          .then(() => callback())
          .catch((err) => {
            logger.error({ error: err }, "Failed to receive email");
            callback(
              new Error("451 Temporary failure, please try again later")
            );
          });
      });
    },
  };

  return new SMTPServer(options);
}

export function startSmtpServer(server: SMTPServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(config.smtp.port, config.smtp.host, () => {
      logger.info(
        {
          host: config.smtp.host,
          port: config.smtp.port,
          starttls: config.smtp.tls.enabled,
        },
        `SMTP server listening${config.smtp.tls.enabled ? " (STARTTLS enabled)" : ""}`
      );
      resolve();
    });

    server.on("error", (err) => {
      logger.error({ error: err }, "SMTP server error");
      reject(err);
    });
  });
}
