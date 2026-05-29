# Task 0169: Opportunity Forecast Category Mapping & Category-Based Forecasting Engine - Implementation Plan

## Step 1: Database Updates
- Add `stageForecastMappings` to `packages/db/src/schema.ts`.
- Export `DBStageForecastMapping` interface in `packages/db/src/index.ts`.
- Add `stageForecastMappings` to `store` array and `dbStore` CRUD operations in `packages/db/src/index.ts`.
- Add `store.stageForecastMappings = []` inside `dbStore.clear()` to ensure tests reset completely.

## Step 2: Core/Forecasting Package Enhancements
- Define category definitions, default stage categories, and `compileForecastCategorySummary` helper inside `packages/forecasting/src/index.ts`.
- Re-export the new types/helpers in `packages/core/src/index.ts` if needed.

## Step 3: REST API Endpoint Implementations
- Add `POST /api/forecasting/stage-mappings` endpoint in `apps/api/src/index.ts` under active tenant RLS authentication.
- Add `GET /api/forecasting/stage-mappings` endpoint in `apps/api/src/index.ts`.
- Add `GET /api/forecasting/categories-summary` endpoint in `apps/api/src/index.ts`, extracting opportunities for the tenant, fetching custom mappings, and invoking the forecast categories compiler.

## Step 4: Integration and RLS Tests
- Create `packages/testing/src/forecast-categories.test.ts`.
- Write thorough tests verifying mapping creation, category summaries, and multi-tenant RLS isolation.

## Step 5: Verification & Cleanup
- Execute `pnpm verify` to check workspace health, compiler type safety, and formatting compliance.
- Git commit changes.
