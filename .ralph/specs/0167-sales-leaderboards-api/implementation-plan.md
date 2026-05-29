# Task 0167: Sales Leaderboards & Quota Attainment API - Implementation Plan

## Step 1: Core Logic Implementation (`packages/core/src/index.ts`)
- Implement `isDateInPeriod(date: Date, period: string): boolean` helper supporting quarterly (`YYYY-QX`) and monthly (`YYYY-MM`) structures.
- Implement and export `calculateSalesLeaderboard` dynamically aggregating opportunities, mapping quotas, calculating attainment, sorting, and ranking performance.

## Step 2: API Route Exposure (`apps/api/src/index.ts`)
- Register the `GET /api/leaderboards` Hono route under `tenantAuth`.
- Retrieve target users by traversing `store.memberships` and matching with `store.users` (or resolving names).
- Retrieve active opportunities and quotas from `dbStore`.
- Normalize period inputs (or fallback to current month YYYY-MM).
- Execute `calculateSalesLeaderboard` and return results as JSON.

## Step 3: Integration and Security Testing (`packages/testing/src/leaderboards.test.ts`)
- Construct an integration test suite `packages/testing/src/leaderboards.test.ts`.
- Assert that sales leaders, representatives, closed opportunities, and quotas are compiled and sorted perfectly.
- Assert that quarterly periods (e.g. `2026-Q1`) and monthly periods (e.g. `2026-05`) compile correctly.
- Assert strict active tenant Row-Level Security (RLS) isolation (Org A cannot query or retrieve any leaderboard details, quotas, or opportunity amounts of Org B).

## Step 4: Verification Pipeline
- Run `pnpm verify` to confirm typescript and linting checks pass perfectly.
- Run `pnpm test` to verify all 74 test suites pass successfully.
