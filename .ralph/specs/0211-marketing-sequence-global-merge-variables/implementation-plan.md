# Specification: Marketing Sequence Global Merge Variables - Implementation Plan

This plan details the step-by-step modifications required to implement the Global Merge Variables feature.

## Step 1: Update DB Schema and Store (`packages/db`)
1. In `packages/db/src/schema.ts`:
   - Declare the `marketingSequenceGlobalVariables` pgTable.
2. In `packages/db/src/index.ts`:
   - Define `DBMarketingSequenceGlobalVariable` interface.
   - Add `marketingSequenceGlobalVariables: [] as DBMarketingSequenceGlobalVariable[]` to `store` type and values.
   - Implement `marketingSequenceGlobalVariables` object inside `dbStore` with `findMany`, `findOne`, `insert`, and `delete` operations matching RLS constraints.
   - Clear the global variables array in `clear()`: `store.marketingSequenceGlobalVariables = [];`.

## Step 2: Implement Global Variable Resolving in Core (`packages/core`)
1. In `packages/core/src/index.ts`:
   - Update `personalizeEmailTemplate` context signature to accept `globalVariables?: Record<string, string> | null`.
   - Update the resolution logic in `resolvePathValue` to intercept prefix `"global"`. If matched, fetch from `context.globalVariables` using the field name as key.

## Step 3: REST API Integration (`apps/api`)
1. In `apps/api/src/index.ts`:
   - Register endpoints:
     - `GET /api/sequences/settings/variables`
     - `POST /api/sequences/settings/variables`
     - `DELETE /api/sequences/settings/variables/:id`
   - Enforce active tenant authenticated context using `tenantAuth` middleware.
   - Block cross-tenant access to variables.

## Step 4: Write Integration Tests (`packages/testing`)
1. Create `packages/testing/src/marketing-sequence-global-variables.test.ts`.
2. Write test cases asserting:
   - CRUD API functionality.
   - Correct template personalization using global placeholders.
   - Proper application of filters to global variables.
   - Robust tenant RLS isolation.

## Step 5: Verification Gate
1. Execute `pnpm verify` to check compilation, formatting, and all test suites.
