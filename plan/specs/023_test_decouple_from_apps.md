# 023 — Decouple 129 test files from `apps/api/src/index` import

**Phase:** 1 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 010

## Description & Expected Impact
Every test in `packages/testing/src/` imports `app from "../../../apps/api/src/index"`. After spec 010 splits the API monolith, tests still need the composed app. Provide a stable test entry point at `packages/testing/src/_harness.ts` that constructs the full Hono app from route modules. Decouples tests from the file path of the entry and lets future per-resource test suites import only the slice they need.

## Definition of Done & Acceptance Criteria
- [ ] New file: `packages/testing/src/_harness.ts` exports `createTestApp(options?: { drivers?: …, seed?: …})`.
- [ ] All 129 test files updated to `import { createTestApp } from "./_harness";` and use `createTestApp()` instead of the direct apps import.
- [ ] Per-resource test files can also import a slice: `createLeadsApp()`, `createOpportunitiesApp()`.
- [ ] `pnpm test` 403/403.
- [ ] `apps/api/src/index.ts` no longer needs to be importable from tests after this change (optional cleanup).

## Implementation Approach
- Sub-agent batch: one Agent per 25 test files → mechanical import swap.
- `_harness.ts` is thin: re-exports the same composed `app` but via a documented public surface.

## Test Strategy
- Regression: 403/403.

## Rollback
Revert imports.
