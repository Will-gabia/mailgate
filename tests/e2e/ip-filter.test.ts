import { describe, it, expect, beforeAll, afterAll } from "vitest";
import nodemailer from "nodemailer";
import { SMTPServer } from "smtp-server";
import { isIpAllowed } from "../../src/smtp/server.js";
import { config } from "../../src/config/index.js";

const blockedHost = "127.0.0.1";
const blockedPort = 9927;

function createBlockedServer(): SMTPServer {
  return new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onConnect(session, callback) {
      const allowlist = ["10.0.0.1"];
      const remoteIp = session.remoteAddress;
      const allowed = allowlist.includes(remoteIp);
      if (!allowed) {
        return callback(new Error("Connection not allowed from your IP"));
      }
      callback();
    },
    onData(stream, _session, callback) {
      stream.on("data", () => undefined);
      stream.on("end", () => callback());
    },
  });
}

describe("ip filtering", () => {
  let server: SMTPServer | null = null;

  beforeAll(async () => {
    server = createBlockedServer();
    await new Promise<void>((resolve, reject) => {
      server?.listen(blockedPort, blockedHost, () => resolve());
      server?.on("error", (err) => reject(err));
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
  });

  it("rejects non-allowed IP via SMTP connect", async () => {
    const transport = nodemailer.createTransport({
      host: blockedHost,
      port: blockedPort,
      secure: false,
    });

    await expect(
      transport.sendMail({
        from: "blocked@example.com",
        to: "receiver@example.com",
        subject: "blocked",
        text: "should fail",
      })
    ).rejects.toThrow();
  });

  it("isIpAllowed respects allowlist", () => {
    expect(isIpAllowed("8.8.8.8")).toBe(false);
    expect(isIpAllowed("127.0.0.1")).toBe(true);
  });

  it("isIpAllowed supports CIDR notation", () => {
    const originalLength = config.smtp.allowedIps.length;
    config.smtp.allowedIps.push("10.0.0.0/8");

    try {
      expect(isIpAllowed("10.1.2.3")).toBe(true);
      expect(isIpAllowed("10.255.255.255")).toBe(true);
      expect(isIpAllowed("11.0.0.1")).toBe(false);
    } finally {
      config.smtp.allowedIps.splice(originalLength);
    }
  });

  it("isIpAllowed supports /24 CIDR", () => {
    const originalLength = config.smtp.allowedIps.length;
    config.smtp.allowedIps.push("192.168.1.0/24");

    try {
      expect(isIpAllowed("192.168.1.100")).toBe(true);
      expect(isIpAllowed("192.168.2.1")).toBe(false);
    } finally {
      config.smtp.allowedIps.splice(originalLength);
    }
  });

  it("isIpAllowed normalizes IPv6-mapped IPv4 addresses", () => {
    expect(isIpAllowed("::ffff:127.0.0.1")).toBe(true);
    expect(isIpAllowed("::ffff:8.8.8.8")).toBe(false);
  });
});
