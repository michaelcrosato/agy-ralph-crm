# Specification: Competitor Win/Loss & Performance Analytics API - Implementation Plan

## Step 1: Core Domain Implementation (`packages/core/src/index.ts`)
- Add interfaces `CompetitorRecord`, `OpportunityRecord`, and `GlobalCompetitorMetrics`.
- Export pure function `calculateGlobalCompetitorAnalytics(params: { competitors: CompetitorRecord[], opportunities: OpportunityRecord[] }): GlobalCompetitorMetrics[]`.
- Write the aggregation logic to group by competitor name, calculate counts, win rate, sum financial values, and compile distinct strengths and weaknesses.

## Step 2: REST API Route Injection (`apps/api/src/index.ts`)
- Import `calculateGlobalCompetitorAnalytics` at the top of the file.
- Register endpoint `GET /api/reports/competitor-analytics`:
  - Enforce `tenantAuth` middleware.
  - Query `dbStore.opportunityCompetitors.findMany()` and `dbStore.opportunities.findMany()`.
  - Filter to local variables for safe grouping, execute pure core calculations, and return results.

## Step 3: Test Suite Implementation (`packages/testing/src/competitor-analytics.test.ts`)
- Create standard multi-tenant testing context.
- Assert that:
  - Global competitor win rates, sums, and compiled texts are correctly aggregated.
  - Multi-tenant RLS isolation is enforced (Tenant A cannot see Tenant B's competitor analytics).
  - Win rates default to `0.0` correctly when no won/lost decisions are logged.
  - Mixed statuses are calculated correctly.

## Step 4: Verification Gate Loop
- Run local biome checking, format, compile check, and test verification:
  - `npx biome check --write .`
  - `pnpm verify`
  - Ensure all pipelines return success.
