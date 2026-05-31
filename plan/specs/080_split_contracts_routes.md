# 080 — Split routes/contracts.ts (427 → ≤400 lines)

**Phase:** 6 · **Priority:** High · **Status:** `[x] Done` · **Depends on:** None

## Description & Expected Impact
`apps/api/src/routes/contracts.ts` has grown to 427 lines (exceeding the 400-line budget limit). It contains standard CRUD, pro-rated maths, renewal opportunity generation, template compiler document merges, batch pro-rated invoicing, and subscriptions in a single file. Decomposing it preserves type-safety and lowers complexity.

## Definition of Done & Acceptance Criteria
- [x] Create route sub-modules under `apps/api/src/routes/contracts/` (each ≤400 lines).
- [x] `contracts/index.ts` barrel composes and exports `contractsApp`, `documentsApp`, `invoicesApp`, and `subscriptionsApp` (≤100 lines).
- [x] Remove monolithic `apps/api/src/routes/contracts.ts`.
- [x] All workspace verify compiler, biome checks, and 546+ integration tests pass 100% green.
- [x] Zero behavioral regressions.

## Implementation Approach
1. Deconstruct and extract subscriptions endpoints to `contracts/subscriptions.ts`.
2. Extract batch pro-rated invoicing endpoints to `contracts/invoices.ts`.
3. Extract document templates and merge compiling to `contracts/documents.ts`.
4. Extract contracts CRUD and renewals opportunity generation to `contracts/contracts.ts`.
5. Compose and re-export the router barrel under `contracts/index.ts`.
6. Safe delete `apps/api/src/routes/contracts.ts` and run workspace verifications.

## Rollback
- Revert directory creation and restore monolithic `apps/api/src/routes/contracts.ts` file from git history.
