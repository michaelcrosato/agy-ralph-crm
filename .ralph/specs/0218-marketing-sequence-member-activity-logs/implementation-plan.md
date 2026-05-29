# Specification: Marketing Sequence Member Activity Logs & Timeline API - Implementation Plan

## 1. Core Engine Implementation
- Export `getMarketingSequenceMemberLogs` in `packages/core/src/index.ts`.
- Expose all timeline aggregation, sorting, and tenant mismatch context checking logic.
- Ensure proper type definitions (`ActivityLogEntry`) are exported or locally declared.

## 2. REST Route Configuration
- In `apps/api/src/index.ts`, register `GET /api/sequences/:id/members/:memberId/logs` route under `tenantAuth`.
- Map the parameters to `getMarketingSequenceMemberLogs` and properly catch/transform error exceptions into correct HTTP status codes (403 for RLS, 404 for Not Found, 400 for bad mappings).

## 3. Integration Tests Scaffold
- Create `packages/testing/src/marketing-sequence-member-logs.test.ts`.
- Write tests to:
  - Populate sequence, membership, email tracker, and all 5 event types.
  - Query chronological logs for Tenant A -> verify correct length, types, and descending sorting.
  - Query chronological logs for Tenant B -> verify strict 403 / RLS isolation block.
  - Attempt queries with bad sequence ID or mismatch membership sequence ID -> verify correct 404/400 validation failures.

## 4. Verification pipeline
- Run `pnpm verify` to check formatting, typescript compilation, and test execution results.
- Commit all changes to Git upon clean passage.
