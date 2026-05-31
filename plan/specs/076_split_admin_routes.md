# 076 — Split routes/admin.ts (789 → ≤400 lines)

**Phase:** 6 · **Priority:** High · **Status:** `[x] Done` · **Depends on:** None

## Description & Expected Impact
`apps/api/src/routes/admin.ts` has grown to 789 lines (nearly 2× the 400-line budget). It contains user management, role management, organization settings, audit log queries, and system health endpoints all in one monolithic file.

## Definition of Done & Acceptance Criteria
- [x] Split admin routes into focused sub-modules under `apps/api/src/routes/admin/`.
- [x] Each sub-module ≤400 lines.
- [x] `admin/index.ts` re-exports and mounts sub-routers (≤100 lines).
- [x] 100% monorepo build, Biome lint, and full test suite pass green.
- [x] Zero behavioral regressions in admin API endpoints.

## Implementation Approach
1. Analyze route groupings in `admin.ts` (user CRUD, role CRUD, org settings, audit, health).
2. Extract each group into a dedicated sub-module (`users.ts`, `roles.ts`, `settings.ts`, etc.).
3. Create `admin/index.ts` that mounts all sub-routers.
4. Update `apps/api/src/index.ts` mount to reference the new admin barrel.
5. Run full verification suite.

## Rollback
- Revert to monolithic `admin.ts` and delete the admin/ directory.
