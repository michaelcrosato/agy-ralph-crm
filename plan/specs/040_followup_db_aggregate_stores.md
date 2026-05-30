# 040 — Follow-up: Split `packages/db/src/index.ts` aggregate stores

**Phase:** 1 (follow-up of spec 012) · **Priority:** High · **Status:** `[ ] Todo`

## Description & Expected Impact
Spec 012 extracted the tenant + RLS helpers (`_tenant.ts`, `_rls.ts`) and added `assertTenantOwns`, but the **70+ aggregate stores remain in the 6.3K-line `packages/db/src/index.ts` monolith**. This follow-up completes the per-aggregate split per the original spec 012 DoD.

## Definition of Done & Acceptance Criteria
- [ ] New `packages/db/src/stores/` directory with one file per aggregate (`leads.ts`, `accounts.ts`, `contacts.ts`, `opportunities.ts`, …).
- [ ] Each store exposes a consistent `{ findMany, findById, insert, update, delete }` shape — barrel-imported via `stores/index.ts`.
- [ ] Inline `if (entity.orgId !== getActiveOrgId()) throw …` blocks (70+ occurrences) replaced with `assertTenantOwns(entity)` from `_rls.ts`.
- [ ] `packages/db/src/index.ts` reduced to **< 200 lines** (re-exports the store surface).
- [ ] No file under `packages/db/src/` exceeds 800 lines.
- [ ] 409 tests pass without modification (no test imports require changes).

## Implementation Approach
- Sub-agent batch: one Agent per ~10 aggregate stores (7 batches for 70 stores). Each Agent reads its slice from the current monolith, writes the new file, and confirms exports.
- Preserve the `dbStore.<aggregate>.<method>` external surface — that's what the API consumes.
- Run `pnpm test` after each batch to catch regressions early.

## Test Strategy
- Regression: 409/409.
- New: extend `packages/testing/src/db-rls.test.ts` with property-based cross-aggregate isolation tests once stores are split.

## Rollback
`git restore packages/db/src/`.
