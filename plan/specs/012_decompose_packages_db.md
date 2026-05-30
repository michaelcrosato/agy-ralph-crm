# 012 — Decompose `packages/db/src/index.ts` (6,312 lines, 70+ store arrays)

**Phase:** 1 · **Priority:** High · **Status:** `[ ] Todo`

## Description & Expected Impact
Mock-store monolith holds 70+ array properties + dbStore CRUD operations with inline RLS checks repeated 70+ times. Split per aggregate so spec 013 (real Postgres) and spec 014 (RLS policies) have a clean target shape. Also enables removing the `Math.random()` IDs (spec 008) via a single helper per file.

## Definition of Done & Acceptance Criteria
- [ ] New directory `packages/db/src/stores/` with one file per aggregate root:
  - `leads.ts`, `accounts.ts`, `contacts.ts`, `opportunities.ts`, `campaigns.ts`, `sequences.ts`, `tickets.ts`, `users.ts`, `organizations.ts`, `metadata.ts`, `webhooks.ts`, `audit.ts`, `email-logs.ts`, …
- [ ] Each store file exposes `{ findMany, findById, insert, update, delete }` with consistent signatures.
- [ ] RLS check extracted into `packages/db/src/_rls.ts` as `assertTenantOwns(entity, ctx)` — used by every store (DRY: 70+ → 1).
- [ ] `withTenant` and `getActiveOrgId` moved to `packages/db/src/_tenant.ts`.
- [ ] `packages/db/src/index.ts` re-exports public surface; < 150 lines.
- [ ] All 403 tests pass; no changes required to test imports.

## Implementation Approach
- Mechanical split first; behavior preservation second. No interface changes.
- Sub-agent batch: one Agent per ~10 aggregates.
- After each batch, `pnpm test` to catch regressions early.

## Test Strategy
- Regression: 403/403.
- RLS unit: write a focused test (`packages/testing/src/db-rls.test.ts`) that verifies `assertTenantOwns` throws on cross-tenant access for at least 3 aggregates.

## Rollback
`git restore packages/db/src/`.
