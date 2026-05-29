# Spec 0139: Multi-Currency & Exchange Rates Engine Implementation Plan

## Phase 1: Database & Stores
1. **Drizzle Schema Update**: Add the `currencies` table definition to `packages/db/src/schema.ts`, and add `currencyCode` and `amountCorporate` fields to `opportunities` table in `packages/db/src/schema.ts`.
2. **Database Types & mockStore Operations**: Add types and `currencies` repository handlers in `packages/db/src/index.ts`. Ensure active tenant RLS context assertion checks.
3. **Verify DB Compilation**: Ensure `pnpm --filter @crm/db build` completes successfully.

## Phase 2: Core Domain Update
1. **Core Utilities**: Add `convertCurrency` and `rollupOpportunityAmountsInBase` utilities to `packages/core/src/index.ts`.
2. **Verify Core Compilation**: Ensure `pnpm --filter @crm/core build` completes successfully.

## Phase 3: REST API & Routing
1. **Hono Route Definition**: Implement currencies retrieve (`GET`) and creation/mutation (`POST`) endpoints under `apps/api/src/index.ts`.
2. **Opportunities Routing Update**: Update opportunity creation (`POST`) and updates (`PATCH`) routes under `apps/api/src/index.ts` to retrieve organization currency definitions, calculate converted amounts, and save them.
3. **Verify API Compilation**: Ensure `pnpm --filter api build` completes successfully.

## Phase 4: Verification & Integration Tests
1. **Integration Test Suite**: Write `packages/testing/src/multi-currency.test.ts` asserting:
   - Currency definition, listing, and updates under strict active tenant RLS isolation.
   - Conversion operations using multiple currencies.
   - Converted corporate currency pipeline calculations on opportunities when saving and updating opportunities.
   - Multi-tenant data leakage prevention assertions.
2. **Run Verification Pipelines**: Execute workspace checks via `pnpm verify` to check compilation, formatting, and unit/integration tests.
