import { execSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_CERT_DIR = "./data/test-tls";

export interface TestCertificates {
  key: string;
  cert: string;
  keyPath: string;
  certPath: string;
  dir: string;
}

let cached: TestCertificates | null = null;

export function generateTestCertificates(): TestCertificates {
  if (cached) return cached;

  if (!existsSync(TEST_CERT_DIR)) {
    mkdirSync(TEST_CERT_DIR, { recursive: true });
  }

  const keyPath = join(TEST_CERT_DIR, "key.pem");
  const certPath = join(TEST_CERT_DIR, "cert.pem");

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 1 -subj "/CN=localhost"`,
      { stdio: "pipe" }
    );
  }

  cached = {
    key: readFileSync(keyPath, "utf-8"),
    cert: readFileSync(certPath, "utf-8"),
    keyPath,
    certPath,
    dir: TEST_CERT_DIR,
  };

  return cached;
}

export function cleanupTestCertificates(): void {
  if (existsSync(TEST_CERT_DIR)) {
    rmSync(TEST_CERT_DIR, { recursive: true, force: true });
  }
  cached = null;
}