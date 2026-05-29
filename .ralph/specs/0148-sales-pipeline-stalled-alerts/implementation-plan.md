# Specification: Sales Pipeline Stalled Alerts API - Implementation Plan

## Step 1: Database Scaffolding
1. Update `packages/db/src/schema.ts` to include the `opportunityStageDurationRules` table.
2. Update `packages/db/src/index.ts` to:
   - Export matching interface `DBOpportunityStageDurationRule`.
   - Add initial state matching getters/setters/methods in the memory store under `dbStore.opportunityStageDurationRules`.

## Step 2: Core Domain Logic
1. Open `packages/core/src/index.ts`.
2. Add interface `StalledOpportunityResult`.
3. Add utility function `calculateStalledOpportunities(opportunities, stageHistory, rules, currentDate)`.
4. Export the newly added interfaces and function.
5. Rebuild core workspace package.

## Step 3: REST API Integration
1. Open `apps/api/src/index.ts`.
2. Implement endpoints:
   - `GET /api/opportunities/stalled`
   - `GET /api/opportunities/stalled/rules`
   - `POST /api/opportunities/stalled/rules`
3. Ensure proper JWT authorization and tenant RLS isolation are enforced via middlewares and active tenant context parameters.

## Step 4: Integration Tests
1. Create `packages/testing/src/stalled-deals.test.ts`.
2. Write unit-level tests validating the mathematics of `calculateStalledOpportunities` (with custom rules, with fallback defaults, and with varying history dates).
3. Write REST API integration tests using session tokens to verify correct data insertion, list operations, and active tenant RLS isolation boundaries.

## Step 5: Verification & Cleanup
1. Run `pnpm verify` to check format/type compliance.
2. Run `pnpm test` to verify Vitest tests run and pass.
3. Commit completed work cleanly to git.
