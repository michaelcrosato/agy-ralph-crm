# Specification: Sales Commission Calculation & Attainment Tracking - Implementation Plan

We will perform the following contiguous implementation steps to fulfill this specification:

## Step 1: Extend `packages/core/src/index.ts`
1. Export `CommissionCalculationInput` and `CommissionResult` interfaces.
2. Implement and export `calculateOpportunityCommission`.

## Step 2: Extend `packages/db/src/schema.ts`
1. Define and export `commissions` pgTable.

## Step 3: Extend `packages/db/src/index.ts`
1. Define and export `DBCommission` interface type.
2. Add `commissions` array to the global mock `store` object.
3. Expose `commissions` sub-store under `dbStore` with standard `findMany`, `findOne`, `insert`, and `update` methods enforcing RLS context.
4. Extend `dbStore.clear()` to purge the commissions store.

## Step 4: Implement REST Routing in `apps/api/src/index.ts`
1. Import `calculateOpportunityCommission` from `@crm/core`.
2. Register endpoints:
   - `POST /api/commissions/calculate`
   - `GET /api/commissions`
   - `POST /api/commissions/:id/approve`
3. Enforce active tenant context verification and RLS isolation in every request handler.

## Step 5: Write Integration & RLS Tests
Create a dedicated test file `packages/testing/src/commissions.test.ts` to test:
- Successful commission calculation for Closed Won opportunity.
- Zero commission calculation for open opportunity.
- Correct tiered rate multipliers based on quota attainment.
- Successful commission approval flow and audit logs.
- Strict active tenant RLS isolation boundaries preventing cross-tenant leakage.
