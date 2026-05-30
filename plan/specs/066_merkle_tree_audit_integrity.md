# Spec 066 — BG-005: Merkle Tree Cryptographic Integrity Audit Pipeline

## Description & Impact

Establish a continuous cryptographic tamper-evidence pipeline for agency CRM audit logs:
- Extend Drizzle schema to include `seq`, `prev_hash`, and `hash` columns in `audit_logs`.
- Implement non-destructive additive DB migrations.
- Intercept database insertions in both Mock and PostgreSQL stores to automatically chain SHA-256 hashes chronologically per organization context.
- Build a robust CLI validation utility `verify-audit-integrity.mjs` validating sequence and hash chaining per tenant organization.
- Wire verification gate to the `agent:doctor` diagnostic suite to block deployment on tampering.

**Impact:** Guarantees absolute enterprise regulatory WORM compliance and tamper evidence for multi-tenant CRM.

## Definition of Done

- [x] Schema modernize `packages/db/src/schema.ts` and `_store.ts` with `seq`, `prevHash`, `hash`.
- [x] Generate additive migration `0005_high_beyonder.sql`.
- [x] Create pure stable JSON stringify and SHA-256 hashing utility in `packages/db/src/stores/audit-hash.ts`.
- [x] Intercept Mock store insertions in `packages/db/src/stores/auditLogs.ts`.
- [x] Intercept PostgreSQL insertions in `packages/db/src/stores/pg-factory.ts`.
- [x] Build CLI validation utility `scripts/agent/verify-audit-integrity.mjs`.
- [x] Wire validation script to `doctor.ps1` and `doctor.sh` as diagnostic pre-flight gates.
- [x] Write extensive integration test suite in `packages/testing/src/audit-integrity.test.ts` verifying chaining, isolation, and positive tamper-evidence checks.

## Approach

### Files modified or created
- `packages/db/src/schema.ts`
- `packages/db/src/_store.ts`
- `packages/db/src/stores/audit-hash.ts`
- `packages/db/src/stores/auditLogs.ts`
- `packages/db/src/stores/pg-factory.ts`
- `scripts/agent/verify-audit-integrity.mjs`
- `scripts/agent/doctor.ps1`
- `scripts/agent/doctor.sh`
- `packages/testing/src/audit-integrity.test.ts`

## Test Strategy
- Execute `npx vitest run packages/testing/src/audit-integrity.test.ts` (all tests must pass).
- Verify CLI execution output and error boundaries under positive tamper-evidence scenarios.

## Depends on
- Spec 038
