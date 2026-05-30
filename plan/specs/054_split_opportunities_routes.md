# Spec 054 — Split `apps/api/src/routes/opportunities.ts` (2,125 lines)

## Description & Impact

`apps/api/src/routes/opportunities.ts` is 2,125 lines — 5× the 400-line budget. It contains opportunity CRUD, products, pricebooks, approvals, splits, competitors, contact roles, teams, and stage management routes. Splitting into focused sub-modules follows the same pattern established by spec 010/041.

**Impact:** Second-largest route file reduced to budget compliance.

## Definition of Done

- [ ] `routes/opportunities.ts` reduced to ≤400 lines.
- [ ] Extracted sub-modules: `crud.ts`, `products.ts`, `pricebooks.ts`, `approvals.ts`, `teams.ts`, `stages.ts`.
- [ ] All existing tests pass without modification.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to modify
- `apps/api/src/routes/opportunities.ts` → directory module
- `apps/api/src/routes/opportunities/crud.ts`
- `apps/api/src/routes/opportunities/products.ts`
- `apps/api/src/routes/opportunities/pricebooks.ts`
- `apps/api/src/routes/opportunities/approvals.ts`
- `apps/api/src/routes/opportunities/teams.ts`
- `apps/api/src/routes/opportunities/stages.ts`

### Pattern
Same directory-module extraction as spec 053. Re-export `opportunitiesApp`, `productsApp`, `pricebooksApp`, `approvalsApp`.

## Test Strategy
Regression-only. All opportunity, product, pricebook, approval, and stage test files must pass unchanged.

## Depends on
None.
