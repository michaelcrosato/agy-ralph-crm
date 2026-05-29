# Specification: Marketing Sequence Link Engagement Analytics - Implementation Plan

## 1. Phase 1: Core Logic
- Implement `calculateLinkEngagementAnalytics` and its input/output interfaces inside `packages/core/src/index.ts`.
- Expose the method and interfaces cleanly.

## 2. Phase 2: REST API Endpoint Integration
- Mount the `GET /api/sequences/:seqId/links-analytics` REST endpoint in `apps/api/src/index.ts`.
- Enforce the `tenantAuth` middleware.
- Query active tenant databases for click events, email trackers, sequence steps, and matching activity records, and feed them into the analytical method.

## 3. Phase 3: Integration Tests
- Create a comprehensive integration test suite `packages/testing/src/marketing-sequence-link-engagement.test.ts`.
- Write tests confirming:
  - Aggregation logic computes CTR correctly.
  - Link grouping works by clicked URL and sequence steps.
  - Tenancy RLS isolation is strictly enforced.

## 4. Phase 4: Verification Pipeline
- Run `pnpm verify` and `pnpm test` at the workspace root to check compiler safety, typecheck rules, lint rules, and test suites.
- Commit all changes cleanly.
