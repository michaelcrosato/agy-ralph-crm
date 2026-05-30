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
