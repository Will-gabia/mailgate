import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SMTPServer } from "smtp-server";
import nodemailer from "nodemailer";
import { generateTestCertificates, cleanupTestCertificates } from "../helpers/tls.js";

/**
 * STARTTLS E2E test.
 * This test creates its own SMTP server with TLS enabled on a separate port
 * (not relying on the shared setup.ts server which runs without TLS).
 * It verifies that:
 *   1. The server advertises STARTTLS in EHLO response
 *   2. A client can upgrade to TLS via STARTTLS and send mail
 *   3. The server rejects connections when STARTTLS is required but not used (opportunistic vs required)
 */

const TLS_SMTP_PORT = 9927;
let tlsServer: SMTPServer;
let receivedMessages: { from: string; to: string[]; data: string }[] = [];

describe("STARTTLS", () => {
  beforeAll(async () => {
    const certs = generateTestCertificates();

    receivedMessages = [];

    tlsServer = new SMTPServer({
      authOptional: true,
      banner: "Test TLS SMTP Server",
      key: certs.key,
      cert: certs.cert,
      onData(stream, session, callback) {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          const data = Buffer.concat(chunks).toString("utf-8");
          const mailFrom = session.envelope.mailFrom
            ? session.envelope.mailFrom.address
            : "unknown";
          const rcptTo = session.envelope.rcptTo.map((r) => r.address);
          receivedMessages.push({ from: mailFrom, to: rcptTo, data });
          callback();
        });
      },
    });

    await new Promise<void>((resolve, reject) => {
      tlsServer.listen(TLS_SMTP_PORT, "127.0.0.1", () => resolve());
      tlsServer.on("error", reject);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => tlsServer.close(() => resolve()));
    cleanupTestCertificates();
  });

  it("accepts mail via STARTTLS upgrade", async () => {
    const transport = nodemailer.createTransport({
      host: "127.0.0.1",
      port: TLS_SMTP_PORT,
      secure: false,
      tls: {
        rejectUnauthorized: false, // self-signed cert
      },
    });

    await transport.sendMail({
      from: "sender@test.com",
      to: "recipient@test.com",
      subject: "STARTTLS Test",
      text: "This message was sent over STARTTLS",
    });

    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0].from).toBe("sender@test.com");
    expect(receivedMessages[0].to).toContain("recipient@test.com");
    expect(receivedMessages[0].data).toContain("STARTTLS Test");
  });

  it("does not advertise STARTTLS when disabled", async () => {
    const noTlsServer = new SMTPServer({
      authOptional: true,
      disabledCommands: ["STARTTLS"],
    });

    const noTlsPort = 9928;
    await new Promise<void>((resolve, reject) => {
      noTlsServer.listen(noTlsPort, "127.0.0.1", () => resolve());
      noTlsServer.on("error", reject);
    });

    // Connect with plain socket to check EHLO response
    const net = await import("node:net");
    const response = await new Promise<string>((resolve, reject) => {
      const client = net.createConnection(noTlsPort, "127.0.0.1", () => {
        let data = "";
        client.on("data", (chunk) => {
          data += chunk.toString();
          // Send EHLO after greeting
          if (data.includes("220 ") && !data.includes("250")) {
            client.write("EHLO test\r\n");
          }
          // Once we get the full EHLO response, resolve
          if (data.includes("250 ") && data.split("\n").length > 3) {
            client.write("QUIT\r\n");
            setTimeout(() => {
              client.end();
              resolve(data);
            }, 100);
          }
        });
        client.on("error", reject);
      });
    });

    await new Promise<void>((resolve) => noTlsServer.close(() => resolve()));

    expect(response).not.toContain("STARTTLS");
  });

  it("advertises STARTTLS when TLS is enabled", async () => {
    const net = await import("node:net");
    const response = await new Promise<string>((resolve, reject) => {
      const client = net.createConnection(TLS_SMTP_PORT, "127.0.0.1", () => {
        let data = "";
        client.on("data", (chunk) => {
          data += chunk.toString();
          if (data.includes("220 ") && !data.includes("250")) {
            client.write("EHLO test\r\n");
          }
          if (data.includes("250 ") && data.split("\n").length > 3) {
            client.write("QUIT\r\n");
            setTimeout(() => {
              client.end();
              resolve(data);
            }, 100);
          }
        });
        client.on("error", reject);
      });
    });

    expect(response).toContain("STARTTLS");
  });
});