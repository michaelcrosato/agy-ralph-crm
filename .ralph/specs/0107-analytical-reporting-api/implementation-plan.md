# Specification: Analytical Reporting & Saved Views REST API - Implementation Plan

## Code Generation Sequence

### Step 1: Database Schema & Mock Store
1. Edit `packages/db/src/schema.ts` to add the `reports` table schema definition.
2. Edit `packages/db/src/index.ts` to add the `DBReport` interface, add the `reports` array to `store`, implement `dbStore.reports` CRUD routines, and include resetting logic in `clear()`.

### Step 2: Reporting Engine
1. Edit `packages/reporting/src/index.ts` to implement the `runReport` analytical engine, grouping and aggregating records dynamically across both standard fields and custom JSONB fields.

### Step 3: API Endpoints
1. Edit `apps/api/src/index.ts` to register the new report routes:
   - `POST /api/reports`
   - `GET /api/reports`
   - `POST /api/reports/run`
   - `GET /api/reports/:id/run`

### Step 4: Verification & Integration Testing
1. Create `packages/testing/src/reports-api.test.ts` to verify the end-to-end analytical reporting CRUD and calculation behavior, including:
   - Creating saved reports under multi-tenant isolation.
   - Running report aggregates (counts, sums, averages) for leads, opportunities, and tickets.
   - Querying grouping values residing inside custom JSONB properties.
   - Asserting robust tenant security and data isolation across tenants.
2. Execute `pnpm verify` and `pnpm test` to confirm exit code 0 status.
