# 081 — Split routes/opportunities/teams.ts (819 → ≤400 lines)

**Phase:** 6 · **Priority:** High · **Status:** `[x] Done` · **Depends on:** None

## Description & Expected Impact
`apps/api/src/routes/opportunities/teams.ts` has grown to 819 lines (exceeding the 400-line budget limit by more than 2×). It contains standard splits, contact roles, campaign influence, competitors win-loss, and opportunity teams in a single file. Decomposing it preserves type-safety and lowers complexity.

## Definition of Done & Acceptance Criteria
- [x] Create route sub-modules under `apps/api/src/routes/opportunities/teams/` (each ≤400 lines).
- [x] `opportunities/teams/index.ts` barrel composes and exports `opportunitiesTeamsApp` (≤100 lines).
- [x] Remove monolithic `apps/api/src/routes/opportunities/teams.ts`.
- [x] All workspace verify compiler, biome checks, and 546+ integration tests pass 100% green.
- [x] Zero behavioral regressions.

## Implementation Approach
1. Deconstruct and extract splits and commissions endpoints to `opportunities/teams/splits.ts`.
2. Extract contact roles endpoints to `opportunities/teams/contact-roles.ts`.
3. Extract campaign influence attribution endpoints to `opportunities/teams/campaign-influence.ts`.
4. Extract deal competitors tracking endpoints to `opportunities/teams/competitors.ts`.
5. Extract team members collaboration endpoints to `opportunities/teams/team-members.ts`.
6. Compose and re-export the router barrel under `opportunities/teams/index.ts`.
7. Safe delete `apps/api/src/routes/opportunities/teams.ts` and run workspace verifications.

## Rollback
- Revert directory creation and restore monolithic `apps/api/src/routes/opportunities/teams.ts` file from git history.
