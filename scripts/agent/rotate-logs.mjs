import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve repository root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const LOG_FILE_PATH = path.join(REPO_ROOT, "test_output.log");
const SIZE_THRESHOLD = 2000000; // 2,000,000 bytes (2MB)

/**
 * Robustly reads a file and auto-detects if it is encoded in UTF-16LE or UTF-8.
 * Normalizes all returns to standard Javascript strings.
 */
function readLogFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 2) {
    // Check for UTF-16LE Byte Order Mark (0xFF 0xFE)
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      return buffer.toString("utf16le");
    }
    // Check for UTF-16BE Byte Order Mark (0xFE 0xFF)
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      return buffer.toString("utf16le"); // simple fallback
    }
  }

  // Probe for high null-byte count which is indicative of UTF-16LE without BOM
  let nullCount = 0;
  const sampleSize = Math.min(buffer.length, 500);
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) nullCount++;
  }
  if (nullCount > sampleSize * 0.1) {
    return buffer.toString("utf16le");
  }

  // Default to standard UTF-8 string decoding
  return buffer.toString("utf8");
}

/**
 * Sanitizes sensitive credentials, JWT tokens, Bearer keys, passwords, and
 * PEM private keys, replacing them with generic redacted tokens.
 */
function sanitizeContent(text) {
  let sanitized = text;

  // 1. Redact PEM Private Keys (RSA/EC/etc.)
  sanitized = sanitized.replace(
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+ PRIVATE KEY-----/g,
    "[REDACTED_PRIVATE_KEY]",
  );

  // 2. Redact HTTP Bearer Auth headers and authorization tokens
  // Run this BEFORE general JWT to ensure "Bearer [REDACTED_SECRET]" is preserved
  sanitized = sanitized.replace(
    /(Bearer\s+)[A-Za-z0-9\-._~+/=]{10,}/gi,
    "$1[REDACTED_SECRET]",
  );
  sanitized = sanitized.replace(
    /(Authorization\s*:\s*Bearer\s+)[A-Za-z0-9\-._~+/=]{10,}/gi,
    "$1[REDACTED_SECRET]",
  );

  // 3. Redact JWT-like tokens (three base64 parts separated by dots, starting with eyJ)
  sanitized = sanitized.replace(
    /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/g,
    "[REDACTED_JWT_TOKEN]",
  );

  // 4. Redact common inline or JSON key-value secrets (e.g. apiKey: "xyz", password=xyz, etc.)
  // Matches keys like apiKey, password, clientSecret, privateKey, dbPass, dbPassword, sessionToken, authToken
  // Captures the surrounding whitespace with the separator to preserve spacing perfectly
  const secretPattern =
    /(api[_-]?key|password|client[_-]?secret|private[_-]?key|session[_-]?token|auth[_-]?token|db[_-]?pass(?:word)?)(\s*[:=]\s*)(["']?)([a-zA-Z0-9\-._~+/=]{8,})\3/gi;
  sanitized = sanitized.replace(
    secretPattern,
    (_match, key, separator, quote, _value) => {
      return `${key}${separator}${quote}[REDACTED_SECRET]${quote}`;
    },
  );

  return sanitized;
}

function main() {
  if (!fs.existsSync(LOG_FILE_PATH)) {
    console.log("No test_output.log found. Gracefully exiting.");
    process.exit(0);
  }

  const stats = fs.statSync(LOG_FILE_PATH);
  const fileSize = stats.size;

  console.log(`Analyzing test_output.log (size: ${fileSize} bytes)`);

  let content;
  try {
    content = readLogFile(LOG_FILE_PATH);
  } catch (error) {
    console.error("Failed to read test_output.log:", error);
    process.exit(1);
  }

  const sanitizedContent = sanitizeContent(content);

  if (fileSize > SIZE_THRESHOLD) {
    console.log(
      `File size ${fileSize} exceeds threshold ${SIZE_THRESHOLD} bytes. Initiating rotation.`,
    );

    const rot3 = path.join(REPO_ROOT, "test_output.3.log");
    const rot2 = path.join(REPO_ROOT, "test_output.2.log");
    const rot1 = path.join(REPO_ROOT, "test_output.1.log");

    // 1. Shift files (.3 is discarded, .2 becomes .3, .1 becomes .2)
    try {
      if (fs.existsSync(rot3)) {
        fs.unlinkSync(rot3);
      }
      if (fs.existsSync(rot2)) {
        fs.renameSync(rot2, rot3);
      }
      if (fs.existsSync(rot1)) {
        fs.renameSync(rot1, rot2);
      }
    } catch (err) {
      console.error("Error shifting rotated log files:", err);
      process.exit(1);
    }

    // 2. Write the sanitized content to test_output.1.log as normalized UTF-8
    try {
      fs.writeFileSync(rot1, sanitizedContent, "utf8");
      console.log("Successfully wrote sanitized history to test_output.1.log");
    } catch (err) {
      console.error("Error writing test_output.1.log:", err);
      process.exit(1);
    }

    // 3. Truncate test_output.log to an empty file
    try {
      fs.writeFileSync(LOG_FILE_PATH, "", "utf8");
      console.log(
        "test_output.log successfully truncated and normalized to UTF-8.",
      );
    } catch (err) {
      console.error("Error truncating test_output.log:", err);
      process.exit(1);
    }
  } else {
    // Write sanitized content back to the main log file in place, normalized to UTF-8
    try {
      fs.writeFileSync(LOG_FILE_PATH, sanitizedContent, "utf8");
      console.log(
        "test_output.log successfully sanitized in-place and normalized to UTF-8.",
      );
    } catch (err) {
      console.error("Error writing sanitized test_output.log in-place:", err);
      process.exit(1);
    }
  }

  console.log(
    "Diagnostics log rotation and sanitization completed successfully.",
  );
}

main();
