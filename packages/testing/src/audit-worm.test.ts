import {
  type AuditRecord,
  buildAuditChain,
  computeMerkleRoot,
  exportWormJsonl,
  GENESIS_HASH,
  verifyAuditChain,
  verifyWormExport,
} from "@crm/audit";
import { describe, expect, it } from "vitest";

const records: AuditRecord[] = [
  {
    orgId: "o1",
    recordId: "r1",
    recordType: "Lead",
    action: "create",
    userId: "u1",
    changes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    orgId: "o1",
    recordId: "r1",
    recordType: "Lead",
    action: "update",
    userId: "u1",
    changes: { status: { before: "New", after: "Working" } },
    createdAt: "2026-01-02T00:00:00.000Z",
  },
  {
    orgId: "o1",
    recordId: "r2",
    recordType: "Account",
    action: "create",
    userId: "u2",
    changes: null,
    createdAt: "2026-01-03T00:00:00.000Z",
  },
];

describe("Spec 038: audit hash chain + WORM export", () => {
  it("chains records with prev_hash links and sequential seq", () => {
    const chain = buildAuditChain(records);
    expect(chain).toHaveLength(3);
    expect(chain[0].prevHash).toBe(GENESIS_HASH);
    expect(chain[0].seq).toBe(0);
    expect(chain[1].prevHash).toBe(chain[0].hash);
    expect(chain[2].prevHash).toBe(chain[1].hash);
    expect(chain[0].hash).toHaveLength(64);
  });

  it("verifies an intact chain and detects tampering", () => {
    const chain = buildAuditChain(records);
    expect(verifyAuditChain(chain)).toEqual({ valid: true });

    const tampered = structuredClone(chain);
    tampered[1].action = "delete";
    const result = verifyAuditChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it("exports verifiable JSON-Lines with a Merkle root", () => {
    const chain = buildAuditChain(records);
    const { jsonl, merkleRoot, count } = exportWormJsonl(chain);
    expect(count).toBe(3);
    expect(jsonl.split("\n")).toHaveLength(3);
    expect(merkleRoot).toHaveLength(64);
    expect(verifyWormExport(jsonl, merkleRoot)).toBe(true);
  });

  it("WORM verification fails when an exported line is altered", () => {
    const chain = buildAuditChain(records);
    const { jsonl, merkleRoot } = exportWormJsonl(chain);
    const lines = jsonl.split("\n");
    const obj = JSON.parse(lines[2]);
    obj.userId = "intruder";
    lines[2] = JSON.stringify(obj);
    expect(verifyWormExport(lines.join("\n"), merkleRoot)).toBe(false);
  });

  it("computes a deterministic Merkle root (empty, single, paired)", () => {
    expect(computeMerkleRoot([])).toBe(GENESIS_HASH);
    expect(computeMerkleRoot(["abc"])).toBe("abc");
    const root = computeMerkleRoot(["a", "b"]);
    expect(root).toHaveLength(64);
    expect(computeMerkleRoot(["a", "b"])).toBe(root);
  });
});
