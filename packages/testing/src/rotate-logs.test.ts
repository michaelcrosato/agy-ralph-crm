import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");
const logPath = path.join(repoRoot, "test_output.log");
const backupPath = path.join(repoRoot, "test_output.log.backup");
const rot1 = path.join(repoRoot, "test_output.1.log");
const rot2 = path.join(repoRoot, "test_output.2.log");
const rot3 = path.join(repoRoot, "test_output.3.log");

describe("Workspace Diagnostics Log Sanitizer & Rotator (TICKET009)", () => {
  let originalLogExists = false;

  beforeAll(() => {
    // Backup existing log file to prevent test side effects
    if (fs.existsSync(logPath)) {
      fs.copyFileSync(logPath, backupPath);
      originalLogExists = true;
    }
    // Clean up rotated files if any exist
    for (const f of [rot1, rot2, rot3]) {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    }
  });

  afterAll(() => {
    // Restore backed up log file
    if (originalLogExists) {
      fs.copyFileSync(backupPath, logPath);
      fs.unlinkSync(backupPath);
    } else if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
    // Clean up rotated files
    for (const f of [rot1, rot2, rot3]) {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    }
  });

  it("handles absent log file gracefully", () => {
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
    const result = execSync("node scripts/agent/rotate-logs.mjs", {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result).toContain("No test_output.log found");
  });

  it("sanitizes JWTs, Bearer headers, passwords, and private keys in place", () => {
    const rawLog = `
Some log line.
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
apiKey: "my-super-secret-api-key-12345"
password=foobar12345
-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBz9bU1bO0v7uM5/7f3g3Q==
-----END EC PRIVATE KEY-----
normal line here.
`;
    fs.writeFileSync(logPath, rawLog, "utf8");

    execSync("node scripts/agent/rotate-logs.mjs", { cwd: repoRoot });

    const sanitized = fs.readFileSync(logPath, "utf8");
    expect(sanitized).toContain("Authorization: Bearer [REDACTED_SECRET]");
    expect(sanitized).toContain('apiKey: "[REDACTED_SECRET]"');
    expect(sanitized).toContain("password=[REDACTED_SECRET]");
    expect(sanitized).toContain("[REDACTED_PRIVATE_KEY]");
    expect(sanitized).toContain("normal line here.");
    expect(sanitized).not.toContain("my-super-secret-api-key-12345");
    expect(sanitized).not.toContain("foobar12345");
    expect(sanitized).not.toContain("MHQCAQEEIBz9bU1bO0v7uM5/7f3g3Q==");
  });

  it("rotates and shifts logs if size exceeds 2MB threshold", () => {
    // Create a log exceeding 2MB (2,000,001 bytes)
    const padding = "A".repeat(2000000);
    const rawLog = `apiKey: "my-secret-key-to-rotate"\n${padding}`;
    fs.writeFileSync(logPath, rawLog, "utf8");

    execSync("node scripts/agent/rotate-logs.mjs", { cwd: repoRoot });

    // The log file should be truncated/empty
    const currentLog = fs.readFileSync(logPath, "utf8");
    expect(currentLog.length).toBe(0);

    // The rotated log should exist as test_output.1.log and be sanitized
    expect(fs.existsSync(rot1)).toBe(true);
    const rotated1 = fs.readFileSync(rot1, "utf8");
    expect(rotated1).toContain('apiKey: "[REDACTED_SECRET]"');
    expect(rotated1.length).toBeGreaterThan(2000000);

    // Run again with a second large log to verify shifting
    fs.writeFileSync(logPath, `password=second-large-log\n${padding}`, "utf8");
    execSync("node scripts/agent/rotate-logs.mjs", { cwd: repoRoot });

    // rot1 should now have the second log, and rot2 should have the first log
    expect(fs.existsSync(rot2)).toBe(true);
    const rotated2 = fs.readFileSync(rot2, "utf8");
    expect(rotated2).toContain('apiKey: "[REDACTED_SECRET]"');

    const newRotated1 = fs.readFileSync(rot1, "utf8");
    expect(newRotated1).toContain("password=[REDACTED_SECRET]");
  });
});
