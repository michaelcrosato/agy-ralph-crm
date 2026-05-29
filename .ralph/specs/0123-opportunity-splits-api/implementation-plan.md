# Task 0123: Opportunity Splits & Multi-Rep Commission Allocation - Implementation Plan

## Step 1: Database Schemas & Store
- Modify `packages/db/src/schema.ts` to add the `opportunitySplits` pgTable configuration.
- Extend `packages/db/src/index.ts` to support the dynamic in-memory collections:
  - Add `DBOpportunitySplit` interface.
  - Register `opportunitySplits` inside `store`.
  - Add CRUD query/mutation layers under `dbStore.opportunitySplits`.
  - Support `clear()` operation tracking the new table collection.

## Step 2: Core Functions
- Open `packages/core/src/index.ts`.
- Export `calculateOpportunitySplits` and standard interfaces for splits.
- Extend commission calculation logic to handle split-based amount rollups and multi-rep payout allocations.

## Step 3: REST API Endpoints
- Modify Hono orchestrator in `apps/api/src/index.ts`:
  - Hook `GET /api/opportunities/:id/splits` fetching splits.
  - Hook `POST /api/opportunities/:id/splits` setting splits, validating 100% split totals, and auto-inserting matching split-commission entries under active tenant RLS bounds.
  - Hook `DELETE /api/opportunities/:id/splits` clearing splits and resetting commissions to opportunity owner.

## Step 4: Integration & Security Tests
- Create `packages/testing/src/opportunity-splits.test.ts` to fully verify splits CRUD, multi-rep commission logic, and strict multi-tenant isolation (confirm Tenant A cannot query or mutate Tenant B splits).

## Step 5: Verification & Format Checks
- Run Biome formatter and workspace compile gates via `pnpm verify`.
