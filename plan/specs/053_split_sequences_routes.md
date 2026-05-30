# Spec 053 — Split `apps/api/src/routes/sequences.ts` (3,296 lines)

## Description & Impact

`apps/api/src/routes/sequences.ts` is 3,296 lines — 8× the 400-line budget. It contains all marketing sequence CRUD, enrollment, step management, execution triggers, email tracking, and analytics routes in a single file. Splitting it into focused sub-modules improves readability, reduces merge conflicts, and enables parallel development.

**Impact:** Brings the largest remaining route file under budget. Unblocks future sequence feature work.

## Definition of Done

- [ ] `routes/sequences.ts` reduced to ≤400 lines (re-exports + mount).
- [ ] Extracted sub-modules under `routes/sequences/` directory: `crud.ts`, `steps.ts`, `enrollment.ts`, `execution.ts`, `analytics.ts`, `emails.ts`.
- [ ] All existing tests pass without modification (behavior-preserving refactor).
- [ ] `pnpm run agent:check` green.

## Approach

### Files to modify
- `apps/api/src/routes/sequences.ts` — split into directory module
- `apps/api/src/routes/sequences/crud.ts` — sequence CRUD routes
- `apps/api/src/routes/sequences/steps.ts` — step management routes
- `apps/api/src/routes/sequences/enrollment.ts` — enrollment routes
- `apps/api/src/routes/sequences/execution.ts` — execution trigger routes
- `apps/api/src/routes/sequences/analytics.ts` — analytics routes
- `apps/api/src/routes/sequences/emails.ts` — email logging/tracking routes

### Pattern
Same pattern as spec 010/041: extract route groups into sub-files, re-mount them from the parent via `app.route()`. Export the same public sub-apps (`sequencesApp`, `emailsApp`, `publicEmailsApp`).

## Test Strategy
Regression-only: all 90+ marketing sequence test files must pass unchanged.

## Depends on
None (behavior-preserving refactor).
