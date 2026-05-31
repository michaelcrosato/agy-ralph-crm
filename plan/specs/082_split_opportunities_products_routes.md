# 082 — Split routes/opportunities/products.ts (620 → ≤400 lines)

**Phase:** 6 · **Priority:** High · **Status:** `[x] Done` · **Depends on:** None

## Description & Expected Impact
`apps/api/src/routes/opportunities/products.ts` has grown to 620 lines (exceeding the 400-line budget limit). It contains products catalog CRUD, opportunity line items, quoting CPQ, and payment schedules in a single file. Decomposing it preserves type-safety and lowers complexity.

## Definition of Done & Acceptance Criteria
- [x] Create route sub-modules under `apps/api/src/routes/opportunities/products/` (each ≤400 lines).
- [x] `opportunities/products/index.ts` barrel composes and exports `productsApp` and `opportunitiesProductsApp` (≤100 lines).
- [x] Remove monolithic `apps/api/src/routes/opportunities/products.ts`.
- [x] All workspace verify compiler, biome checks, and 546+ integration tests pass 100% green.
- [x] Zero behavioral regressions.

## Implementation Approach
1. Deconstruct and extract products catalog CRUD endpoints to `opportunities/products/products.ts`.
2. Extract opportunity line items endpoints to `opportunities/products/line-items.ts`.
3. Extract quoting CPQ endpoints to `opportunities/products/quotes.ts`.
4. Extract payment schedules endpoints to `opportunities/products/schedules.ts`.
5. Compose and re-export the router barrel under `opportunities/products/index.ts`.
6. Safe delete `apps/api/src/routes/opportunities/products.ts` and run workspace verifications.

## Rollback
- Revert directory creation and restore monolithic `apps/api/src/routes/opportunities/products.ts` file from git history.
