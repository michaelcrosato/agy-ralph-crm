import pino, { type Logger, type LoggerOptions } from "pino";

/**
 * PII fields that must NEVER appear in logs. Pino serializers redact
 * these by name before emitting. Add new fields here when the schema
 * grows — do not log full request bodies or user content.
 */
const REDACTED_PATHS = [
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.email",
  "*.phone",
  "*.ssn",
  "*.creditCard",
  "req.headers.authorization",
  "req.headers.cookie",
];

const rootOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: REDACTED_PATHS, censor: "[REDACTED]" },
  base: { pid: process.pid },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const root = pino(rootOptions);

/** Construct a named child logger (e.g. `createLogger({ name: "api.leads" })`). */
export function createLogger(opts: { name: string }): Logger {
  return root.child({ name: opts.name });
}

/** The root logger — prefer createLogger({ name }) for component-level logs. */
export const logger = root;

export type { Logger } from "pino";
