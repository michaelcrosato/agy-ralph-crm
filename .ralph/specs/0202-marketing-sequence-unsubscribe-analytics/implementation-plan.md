# Specification: Marketing Sequence Unsubscribe Analytics - Implementation Plan

## 1. Execution Steps

### Step 1: Core Function Implementation
- Add `calculateUnsubscribeAnalytics` in `packages/core/src/index.ts`.
- Export it from `packages/core` (which is already exported by `packages/core/src/index.ts`).

### Step 2: Hono API Routing
- Add the route `GET /api/unsubscribes/analytics` in `apps/api/src/index.ts`.
- Fetch all necessary records from `dbStore` inside the route, pass to the analytical utility, and return the response.

### Step 3: Write Integration and RLS Tests
- Create `packages/testing/src/marketing-sequence-unsubscribe-analytics.test.ts`.
- Include tests to assert:
  - Aggregation logic computes correct counts and percentages.
  - Correct sequence attribution matching.
  - Strict tenant RLS boundaries (Tenant A cannot see Tenant B's analytics).

### Step 4: Run Verification Pipeline
- Run `pnpm verify` to check type safety and biome linting.
- Run `pnpm test` to verify Vitest tests.

### Step 5: Git Commit
- Add all new/modified files to Git and commit.
