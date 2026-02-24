import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import nodemailer from "nodemailer";
import { SMTPServer } from "smtp-server";
import { checkRateLimit, resetRateLimiter } from "../../src/rate-limiter/index.js";

describe("rate limiting", () => {
  describe("checkRateLimit unit tests", () => {
    beforeEach(() => {
      resetRateLimiter();
    });

    it("allows connections within rate limit", () => {
      const result = checkRateLimit("192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.total).toBe(100);
    });

    it("tracks connections per IP independently", () => {
      // Exhaust limit for one IP
      for (let i = 0; i < 100; i++) {
        checkRateLimit("10.0.0.1");
      }

      // Another IP should still be allowed
      const result = checkRateLimit("10.0.0.2");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it("rejects connections when rate limit is exceeded", () => {
      const ip = "10.0.0.100";

      // Exhaust the limit
      for (let i = 0; i < 100; i++) {
        const r = checkRateLimit(ip);
        expect(r.allowed).toBe(true);
      }

      // Next connection should be rejected
      const rejected = checkRateLimit(ip);
      expect(rejected.allowed).toBe(false);
      expect(rejected.remaining).toBe(0);
      expect(rejected.resetAt).toBeGreaterThan(Date.now());
    });

    it("normalizes IPv6-mapped IPv4 addresses", () => {
      // These should be treated as the same IP
      for (let i = 0; i < 99; i++) {
        checkRateLimit("::ffff:192.168.1.50");
      }

      // Using the non-mapped form should share the counter
      const result = checkRateLimit("192.168.1.50");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);

      // Now it should be rejected
      const rejected = checkRateLimit("192.168.1.50");
      expect(rejected.allowed).toBe(false);
    });

    it("resets rate limiter state", () => {
      const ip = "10.0.0.200";
      for (let i = 0; i < 100; i++) {
        checkRateLimit(ip);
      }
      expect(checkRateLimit(ip).allowed).toBe(false);

      resetRateLimiter();

      const result = checkRateLimit(ip);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });
  });

  describe("SMTP integration", () => {
    const rateLimitHost = "127.0.0.1";
    const rateLimitPort = 9929;
    let server: SMTPServer | null = null;
    let connectionCount: number;
    const maxConnections = 3;

    beforeAll(async () => {
      connectionCount = 0;
      server = new SMTPServer({
        authOptional: true,
        disabledCommands: ["STARTTLS"],
        onConnect(session, callback) {
          connectionCount++;
          if (connectionCount > maxConnections) {
            return callback(
              new Error("Too many connections, please try again later")
            );
          }
          callback();
        },
        onData(stream, _session, callback) {
          stream.on("data", () => undefined);
          stream.on("end", () => callback());
        },
      });
      await new Promise<void>((resolve, reject) => {
        server?.listen(rateLimitPort, rateLimitHost, () => resolve());
        server?.on("error", (err) => reject(err));
      });
    });

    beforeEach(() => {
      connectionCount = 0;
    });

    afterAll(async () => {
      if (server) {
        await new Promise<void>((resolve) => server?.close(() => resolve()));
      }
    });

    it("accepts connections within the limit", async () => {
      const transport = nodemailer.createTransport({
        host: rateLimitHost,
        port: rateLimitPort,
        secure: false,
      });

      // Should succeed within the limit
      await expect(
        transport.sendMail({
          from: "sender@example.com",
          to: "receiver@example.com",
          subject: "Rate limit test",
          text: "This should succeed",
        })
      ).resolves.toBeDefined();
    });

    it("rejects connections exceeding the limit", async () => {
      // Send maxConnections successful connections first
      for (let i = 0; i < maxConnections; i++) {
        const transport = nodemailer.createTransport({
          host: rateLimitHost,
          port: rateLimitPort,
          secure: false,
        });
        await transport.sendMail({
          from: `sender${i}@example.com`,
          to: "receiver@example.com",
          subject: `test ${i}`,
          text: `msg ${i}`,
        });
      }

      // The next connection should fail
      const transport = nodemailer.createTransport({
        host: rateLimitHost,
        port: rateLimitPort,
        secure: false,
      });

      await expect(
        transport.sendMail({
          from: "excess@example.com",
          to: "receiver@example.com",
          subject: "should fail",
          text: "rate limited",
        })
      ).rejects.toThrow();
    });
  });
});
