# Specification: Opportunity Product Schedules API - Implementation Plan

## 1. Schema Expansion
- Extend `packages/db/src/schema.ts` to include the `opportunityProductSchedules` table definition.
- Extend `packages/db/src/index.ts` to include the `DBOpportunityProductSchedule` interface and register `opportunityProductSchedules` in the memory `store` and `dbStore` active adapters.

## 2. Core Business Logic
- Implement pure domain logic functions inside `packages/core/src/index.ts`:
  - `validateOpportunityProductSchedule` validating UUID inputs, amounts, dates, and type formats.
  - `generateStraightLineSchedules` partitioning total revenue/quantity into equal monthly increments.

## 3. Router Integration
- Integrate Hono routes inside `apps/api/src/index.ts`:
  - `GET /api/opportunities/:id/products/:productId/schedules`
  - `POST /api/opportunities/:id/products/:productId/schedules`
  - `DELETE /api/opportunities/:id/products/:productId/schedules/:scheduleId`
  - `POST /api/opportunities/:id/products/:productId/schedules/generate`
- Inject audit logging and validation logic in the Hono handlers.

## 4. Testing
- Scaffold `packages/testing/src/opportunity-product-schedules.test.ts`.
- Run complete test suites via `pnpm verify` to confirm 100% compliance.
