# Specification: Marketing Sequence Call Actions - Implementation Plan

## 1. Phase 1: Database Types & Schema Updates
- Edit `packages/db/src/schema.ts` to add `callScript` column to `marketingSequenceSteps` table.
- Edit `packages/db/src/index.ts` to update `DBMarketingSequenceStep` and ensure `"call"` is in the `stepType` union.

## 2. Phase 2: Core Execution Engine updates
- Edit `packages/core/src/index.ts` to extend `CoreSequenceStep` and signature of `executePendingSequenceSteps` parameters to support `"call"`.
- Inside `executePendingSequenceSteps`, add execution block for `step.stepType === "call"`.
- Run personalization on `callScript` and insert a CRM Activity of type `"call"`, then link it to the recipient record.

## 3. Phase 3: REST Router Endpoints
- Edit `apps/api/src/index.ts` to update step insertion inside `POST /api/sequences/:id/steps`.
- Validate that `stepType` allows `"call"`, and require `callScript` to be non-empty.
- Insert `callScript` property during DB step insertion.

## 4. Phase 4: Integration testing
- Create comprehensive integration tests inside `packages/testing/src/marketing-sequence-call-actions.test.ts`.
- Verify API endpoints, input validation, personalization, activity and link generation, and strict active tenant RLS isolation.
- Run `pnpm verify` to confirm workspace compiles and all tests pass perfectly.
