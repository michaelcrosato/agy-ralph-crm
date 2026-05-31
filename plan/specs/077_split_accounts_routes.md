# 077 — Split routes/accounts.ts (624 → ≤400 lines)

**Phase:** 6 · **Priority:** High · **Status:** `[~] In Progress` · **Depends on:** None

## Description & Expected Impact
`apps/api/src/routes/accounts.ts` has grown to 624 lines (exceeding the 400-line budget limit). It contains standard CRUD, validation rule hooks, duplicate analytics, hierarchy consolidations, and territory routing logic in a single file. Decomposing it preserves type-safety and lowers complexity.

## Definition of Done & Acceptance Criteria
- [ ] Create route sub-modules under `apps/api/src/routes/accounts/` (each ≤400 lines).
- [ ] `accounts/index.ts` barrel composes and exports the final `accountsApp` (≤100 lines).
- [ ] Remove monolithic `apps/api/src/routes/accounts.ts`.
- [ ] All workspace verify compiler, biome checks, and 544+ integration tests pass 100% green.
- [ ] Zero behavioral regressions.

## Implementation Approach
1. Deconstruct and extract CRUD routes to `accounts/crud.ts`.
2. Extract team members routes to `accounts/team.ts`.
3. Extract hierarchy and consolidated rollup pipeline routes to `accounts/hierarchy.ts`.
4. Extract duplicates checking, record merging, and territory routing routes to `accounts/operations.ts`.
5. Compose and re-export the router barrel under `accounts/index.ts`.
6. Safe delete `apps/api/src/routes/accounts.ts` and run workspace verifications.

## Rollback
- Revert directory creation and restore monolithic `apps/api/src/routes/accounts.ts` file from git history.
