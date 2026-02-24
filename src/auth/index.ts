import { logger } from "../config/logger.js";

export interface AuthVerificationResult {
  dkim: "pass" | "fail" | "none" | "error";
  spf: "pass" | "fail" | "none" | "softfail" | "error";
}

/**
 * Verify DKIM and SPF for an email message.
 * Uses the `mailauth` package for verification.
 * Falls back gracefully if the package is not installed.
 */
export async function verifyEmailAuth(
  rawMessage: string,
  remoteIp: string,
  mailFrom: string
): Promise<AuthVerificationResult> {
  const defaultResult: AuthVerificationResult = { dkim: "none", spf: "none" };

  try {
    // Dynamic import — mailauth is an optional dependency
    const moduleName = "mailauth";
    const { authenticate } = await import(moduleName);

    const result = await authenticate(
      Buffer.from(rawMessage),
      {
        ip: remoteIp.replace(/^::ffff:/, ""),
        helo: mailFrom.split("@")[1] || "unknown",
        sender: mailFrom,
        mta: "mail-gateway",
      }
    );

    const dkimStatus = result?.dkim?.results?.[0]?.status?.result;
    const spfStatus = result?.spf?.status?.result;

    const dkim = parseDkimResult(dkimStatus);
    const spf = parseSpfResult(spfStatus);

    logger.info({ dkim, spf, mailFrom }, "Email authentication verification completed");

    return { dkim, spf };
  } catch (err) {
    // mailauth not installed or verification error
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Cannot find module") || message.includes("Cannot find package")) {
      logger.debug("mailauth package not installed, skipping DKIM/SPF verification");
      return defaultResult;
    }
    logger.warn({ error: message }, "Email authentication verification failed");
    return { dkim: "error", spf: "error" };
  }
}

function parseDkimResult(status: string | undefined): AuthVerificationResult["dkim"] {
  if (!status) return "none";
  switch (status.toLowerCase()) {
    case "pass":
      return "pass";
    case "fail":
    case "policy":
    case "neutral":
    case "permerror":
      return "fail";
    case "temperror":
      return "error";
    default:
      return "none";
  }
}

function parseSpfResult(status: string | undefined): AuthVerificationResult["spf"] {
  if (!status) return "none";
  switch (status.toLowerCase()) {
    case "pass":
      return "pass";
    case "fail":
      return "fail";
    case "softfail":
      return "softfail";
    case "neutral":
    case "none":
      return "none";
    case "temperror":
    case "permerror":
      return "error";
    default:
      return "none";
  }
}