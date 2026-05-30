import { createHash } from "node:crypto";

/**
 * Tamper-evident audit log core (spec 038): SHA-256 hash chain + Merkle-root
 * WORM export. Pure + deterministic — the Postgres append-only enforcement
 * (REVOKE UPDATE/DELETE + immutability trigger) and the fs/S3 export sink wire
 * on top of this.
 */

export const GENESIS_HASH = "0".repeat(64);

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Stable JSON: object keys sorted recursively, so hashing is order-independent. */
function stableStringify(value: unknown): string {
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

export interface AuditRecord {
  orgId: string;
  recordId: string;
  recordType: string;
  action: string;
  userId: string;
  changes?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChainedAuditEntry extends AuditRecord {
  seq: number;
  prevHash: string;
  hash: string;
}

export function computeAuditHash(
  record: AuditRecord,
  seq: number,
  prevHash: string,
): string {
  return sha256(`${prevHash}|${seq}|${stableStringify(record)}`);
}

export function buildAuditChain(
  records: AuditRecord[],
  genesis: string = GENESIS_HASH,
): ChainedAuditEntry[] {
  const chain: ChainedAuditEntry[] = [];
  let prevHash = genesis;
  records.forEach((record, seq) => {
    const hash = computeAuditHash(record, seq, prevHash);
    chain.push({ ...record, seq, prevHash, hash });
    prevHash = hash;
  });
  return chain;
}

export interface ChainVerification {
  valid: boolean;
  /** Index of the first entry that fails verification, if any. */
  brokenAt?: number;
}

export function verifyAuditChain(
  chain: ChainedAuditEntry[],
  genesis: string = GENESIS_HASH,
): ChainVerification {
  let prevHash = genesis;
  for (let i = 0; i < chain.length; i++) {
    const { seq, prevHash: storedPrev, hash, ...record } = chain[i];
    if (storedPrev !== prevHash || seq !== i) {
      return { valid: false, brokenAt: i };
    }
    if (computeAuditHash(record, seq, storedPrev) !== hash) {
      return { valid: false, brokenAt: i };
    }
    prevHash = hash;
  }
  return { valid: true };
}

/** Merkle root over leaf hashes (duplicate the last node on odd levels). */
export function computeMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) return GENESIS_HASH;
  let level = [...leafHashes];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(sha256(left + right));
    }
    level = next;
  }
  return level[0];
}

export interface WormExport {
  jsonl: string;
  merkleRoot: string;
  count: number;
}

/** Serialize a chain to JSON-Lines plus a Merkle root for legal-hold export. */
export function exportWormJsonl(chain: ChainedAuditEntry[]): WormExport {
  return {
    jsonl: chain.map((entry) => JSON.stringify(entry)).join("\n"),
    merkleRoot: computeMerkleRoot(chain.map((entry) => entry.hash)),
    count: chain.length,
  };
}

/** Verify a WORM export: hash chain intact AND Merkle root matches. */
export function verifyWormExport(
  jsonl: string,
  expectedMerkleRoot: string,
  genesis: string = GENESIS_HASH,
): boolean {
  if (jsonl.trim() === "") return expectedMerkleRoot === GENESIS_HASH;
  const chain = jsonl
    .split("\n")
    .map((line) => JSON.parse(line) as ChainedAuditEntry);
  return (
    verifyAuditChain(chain, genesis).valid &&
    computeMerkleRoot(chain.map((entry) => entry.hash)) === expectedMerkleRoot
  );
}
