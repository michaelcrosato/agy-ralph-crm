# Task 0163: High Scale Seeder and Fuzz Testing Engine - Implementation Plan

## Phase 1: Core Upgrades
1. Update `packages/testing/src/index.ts` to implement `generateFuzzData` and `generateHighScaleSeed`.
2. Add high-scale seeding capabilities to the `dbStore` directly or via programmatic loops in the testing utility.

## Phase 2: REST Endpoint Hooks
1. Expose `POST /api/admin/seed` in `apps/api/src/index.ts`.
2. Expose `POST /api/admin/fuzz` in `apps/api/src/index.ts`.
3. Integrate both endpoints with standard `tenantAuth` checks.

## Phase 3: Verification Integration
1. Write a Vitest suite in `packages/testing/src/high-scale-fuzz.test.ts`.
2. Run standard local verification and git integration tests.
3. Validate workspace compile and formatting checks using `pnpm verify`.
