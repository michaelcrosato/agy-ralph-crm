# Specification: Marketing Sequence Step Performance Analytics API - Implementation Plan

## 1. Phase 1: Core Logic Updates
- Modify `executePendingSequenceSteps` in `packages/core/src/index.ts` to insert into `dbStore.emailTrackers` when sequence emails are dispatched.
- Implement the `calculateSequenceAnalytics` analytical rollup function in `packages/core/src/index.ts`.
- Run typescript compilation in `packages/core` to confirm syntax correctness.

## 2. Phase 2: Hono API Routing Integration
- Mount the `GET /api/sequences/:id/analytics` endpoint in `apps/api/src/index.ts`.
- Enforce strict tenancy RLS, throwing `404` or RLS violation on sequence mismatch.

## 3. Phase 3: Verification Suite
- Create integration test suite `packages/testing/src/marketing-sequence-analytics.test.ts`.
- Assert email trackers are auto-generated during step runs.
- Validate pro-rated click and open percentages math.
- Test cross-tenant RLS boundaries (Tenant B must not see Tenant A's sequence stats).

## 4. Phase 4: Final Workspace Gate
- Execute `pnpm verify` to confirm workspace compiles cleanly and Biome lints pass perfectly.
