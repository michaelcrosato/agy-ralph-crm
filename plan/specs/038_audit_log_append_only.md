# 038 — Audit log → append-only Postgres table + WORM export

**Phase:** 2 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 014

## Description & Expected Impact
`packages/audit/` exists but the table model permits UPDATE/DELETE — compliance-hostile. Make `audit_logs` truly append-only via Postgres role permissions + a trigger preventing UPDATE/DELETE. Add daily WORM export (write once, read many) to object storage (S3-compatible) for legal hold.

## Definition of Done & Acceptance Criteria
- [ ] Migration: REVOKE UPDATE, DELETE ON audit_logs FROM application_role.
- [ ] Trigger `audit_logs_immutable` that RAISES on UPDATE or DELETE.
- [ ] Daily export job (`packages/core/src/domain/audit/export.ts`) writes signed JSON-Lines to `s3://` (or local fs in dev) keyed by `audit/YYYY/MM/DD/orgId.jsonl.zst`.
- [ ] Hash chain: each row's `prev_hash` references previous row's SHA-256; export includes Merkle root for tamper detection.
- [ ] Tests: 3 — append works, update throws, export creates valid JSON-Lines with verifiable hash chain.

## Implementation Approach
- Use `pg`'s `RAISE EXCEPTION` trigger to enforce immutability at the engine level.
- Hash chain implemented in application code on insert (no triggers needed).
- Export pluggable storage adapter (`s3`, `gcs`, `fs`); default `fs` for local.

## Test Strategy
- Integration: 3 new tests.
- Regression: existing audit tests pass.

## Rollback
Drop trigger; restore role grants.

## Implementation Notes (delivered on branch `spec/038-audit-worm`)

Delivered the tamper-evident WORM core in `packages/audit/src/worm.ts` (no PG):

- SHA-256 hash chain: `buildAuditChain(records)` links each entry's `prevHash` to the
  prior entry's `hash` (genesis for the first), with sequential `seq`. `computeAuditHash`
  hashes `prevHash | seq | stableStringify(record)` (key-sorted, order-independent).
- `verifyAuditChain(chain)` recomputes every hash + checks the links → `{ valid,
  brokenAt }`; detects any after-the-fact mutation.
- `exportWormJsonl(chain)` → JSON-Lines + a Merkle root (`computeMerkleRoot`);
  `verifyWormExport(jsonl, root)` re-validates both the chain and the root.
- 5 tests (chain links; intact vs tampered; JSON-Lines export + Merkle verify;
  altered-line detection; deterministic Merkle root). Full suite 456/456 green;
  `@crm/audit` verify clean. Added `@types/node` to `@crm/audit` for `node:crypto`
  (matches `@crm/webhooks`).

### [ASSUMPTION]s (smallest-reversible, per mission guardrails)
- **Postgres append-only enforcement deferred:** the migration (`REVOKE UPDATE, DELETE`)
  + `audit_logs_immutable` trigger need PG (Docker) + the db package (concurrent
  writer's territory). The hash chain (application-side, exactly as the spec's
  Implementation Approach proposes) is the tamper-evidence layer and is done here.
- **Storage sink + daily job deferred:** the fs/S3 adapter and the daily export job
  (`domain/audit/export.ts`) are I/O wiring over `exportWormJsonl`. → follow-up.
