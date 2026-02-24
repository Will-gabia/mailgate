import { SMTPServer } from "smtp-server";

export interface CapturedMessage {
  envelope: {
    mailFrom: string | null;
    rcptTo: string[];
  };
  remoteAddress: string;
  raw: string;
}

export interface CaptureServer {
  server: SMTPServer;
  messages: CapturedMessage[];
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createCaptureServer(
  host: string,
  port: number
): CaptureServer {
  const messages: CapturedMessage[] = [];

  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        messages.push({
          envelope: {
            mailFrom: session.envelope.mailFrom
              ? session.envelope.mailFrom.address
              : null,
            rcptTo: session.envelope.rcptTo.map((r) => r.address),
          },
          remoteAddress: session.remoteAddress,
          raw,
        });
        callback();
      });
    },
  });

  return {
    server,
    messages,
    start: () =>
      new Promise<void>((resolve, reject) => {
        server.listen(port, host, () => resolve());
        server.on("error", (err) => reject(err));
      }),
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
