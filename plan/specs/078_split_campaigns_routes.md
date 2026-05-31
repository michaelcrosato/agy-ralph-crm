# 078 — Split routes/campaigns.ts (534 → ≤400 lines)

**Phase:** 6 · **Priority:** High · **Status:** `[x] Done` · **Depends on:** None

## Description & Expected Impact
`apps/api/src/routes/campaigns.ts` has grown to 534 lines (exceeding the 400-line budget limit). It contains standard CRUD, picklist/custom validations, dynamic segment memberships resolution, email blasts, and ROI attribution logic in a single file. Decomposing it preserves type-safety and lowers complexity.

## Definition of Done & Acceptance Criteria
- [x] Create route sub-modules under `apps/api/src/routes/campaigns/` (each ≤400 lines).
- [x] `campaigns/index.ts` barrel composes and exports `campaignsApp`, `segmentsApp`, and `unsubscribesApp` (≤100 lines).
- [x] Remove monolithic `apps/api/src/routes/campaigns.ts`.
- [x] All workspace verify compiler, biome checks, and 544+ integration tests pass 100% green.
- [x] Zero behavioral regressions.

## Implementation Approach
1. Deconstruct and extract unsubscribes endpoints to `campaigns/unsubscribes.ts`.
2. Extract marketing segments endpoints, dynamic segment members list resolver, and sequence enrollment to `campaigns/segments.ts`.
3. Extract campaigns endpoints, status updates, members updates, email blast, and ROI/attribution to `campaigns/campaigns.ts`.
4. Compose and re-export the router barrel under `campaigns/index.ts`.
5. Safe delete `apps/api/src/routes/campaigns.ts` and run workspace verifications.

## Rollback
- Revert directory creation and restore monolithic `apps/api/src/routes/campaigns.ts` file from git history.
