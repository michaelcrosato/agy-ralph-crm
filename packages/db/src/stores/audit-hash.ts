import { createHash } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Stable JSON stringify: object keys sorted recursively so hashing is order-independent. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export interface AuditRecordPayload {
  orgId: string;
  recordId: string;
  recordType: string;
  action: string;
  userId: string;
  changes?: Record<string, unknown> | null;
  createdAt: string;
}

export function computeAuditHash(
  record: AuditRecordPayload,
  seq: number,
  prevHash: string,
): string {
  return sha256(`${prevHash}|${seq}|${stableStringify(record)}`);
}
