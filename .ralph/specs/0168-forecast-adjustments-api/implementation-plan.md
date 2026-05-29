# Task 0168: Forecast Adjustments & Manager Target Overrides API - Implementation Plan

## Step 1: Database Schema Expansion
- Modify `packages/db/src/schema.ts` to add the `forecastAdjustments` table definition.
- Modify `packages/db/src/index.ts` to export type definitions, interfaces, in-memory mock schema, and standard RLS-enforced dbStore wrapping.

## Step 2: Core Logic Implementation
- Expose pure forecast adjustment logic `calculateAdjustedForecast` in `packages/core/src/index.ts`.
- Calculate base/adjusted quotas, weighted amounts, and corresponding quota attainments.

## Step 3: REST API Endpoint Routing
- Expose the `GET /api/forecasts/adjustments`, `POST /api/forecasts/adjustments`, and `GET /api/forecasts/adjusted-summary` routes under Hono API server (`apps/api/src/index.ts`) protected by the `tenantAuth` middleware.

## Step 4: Integration and Security Testing
- Create `packages/testing/src/forecast-adjustments.test.ts` to fully assert manager overrides, adjustments, quota attainment changes, and row-level security boundaries.
