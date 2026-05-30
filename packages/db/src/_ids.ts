import { v7 as uuidv7 } from "uuid";

/**
 * Time-ordered ID generator using UUID v7.
 * Replaces legacy `Math.random().toString(36).substring(2, 11)` sites.
 * Preserves the existing prefix-encoded form: `genId("lead") -> "lead-018f…"`.
 */
export function genId(prefix: string): string {
  return `${prefix}-${uuidv7()}`;
}
