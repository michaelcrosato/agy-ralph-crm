# Specification: Sales Forecasting & Quota Engine - Implementation Plan

## Code Generation Sequence

### Step 1: Database Table Additions & Schema Exports
- Update `packages/db/src/schema.ts` to include the `quotas` and `stageProbabilities` tables.
- Update `packages/db/src/index.ts` to include matching TypeScript interfaces (`DBQuota`, `DBStageProbability`) and memory store access handlers (`dbStore.quotas`, `dbStore.stageProbabilities`).

### Step 2: Create packages/forecasting Workspace Package
- Generate package configuration files: `packages/forecasting/package.json`, `packages/forecasting/tsconfig.json`.
- Implement `packages/forecasting/src/index.ts` with pure arithmetic forecasting helpers:
  - `calculateWeightedForecast`
  - `calculateQuotaAttainment`
  - `aggregateForecasts`
- Wire `@crm/forecasting` into the root pnpm monorepo workspace.

### Step 3: Integrate REST API Routes
- Add API endpoints `/api/quotas`, `/api/forecasting/probabilities`, and `/api/forecasting/summary` to Hono API router `apps/api/src/index.ts`.
- Integrate `@crm/forecasting` calculations into the summary generation endpoint.

### Step 4: Verification Unit & Integration Tests
- Create `packages/testing/src/forecasting.test.ts` to verify aggregation mathematics, period grouping, probability custom overrides, and strict multi-tenant RLS isolation checks on quotas and forecast summary queries.

### Step 5: Verify Monorepo Stability
- Execute `pnpm verify` to assert styling compliance.
- Execute `pnpm build` to verify clean compilation.
- Execute `pnpm test` to verify all Vitest execution checks.
