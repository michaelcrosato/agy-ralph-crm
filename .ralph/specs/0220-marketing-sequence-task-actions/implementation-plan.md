# Specification: Marketing Sequence Task Actions - Implementation Plan

## 1. Phase 1: Database Types & Schema Updates
- Edit `packages/db/src/schema.ts` to add `taskSubject`, `taskBody`, and `taskDueDays` columns to the `marketingSequenceSteps` table.
- Edit `packages/db/src/index.ts` to extend `DBMarketingSequenceStep` and ensure in-memory stubs support the new columns.

## 2. Phase 2: Core Execution Engine updates
- Edit `packages/core/src/index.ts` to extend the sequence step processing logic inside `executePendingSequenceSteps`.
- Add support for `step.stepType === "task"`.
- Fetch the lead/contact `ownerId` and build recipientContext variables.
- Call `personalizeEmailTemplate` to customize the task's subject and description/body.
- Insert the new Activity and Activity Link records under active tenant RLS context.
- Verify typescript types compile cleanly inside `packages/core`.

## 3. Phase 3: REST Router endpoints
- Edit `apps/api/src/index.ts` to update `POST /api/sequences/:id/steps`.
- Validate `stepType` can be `"task"`, requiring `taskSubject`.
- Extract `taskSubject`, `taskBody`, and `taskDueDays` from the request body and save them during step insertion.

## 4. Phase 4: Integration testing
- Write comprehensive integration tests inside `packages/testing/src/marketing-sequence-task-actions.test.ts`.
- Verify successful task step execution, personalization, activity and link insertion, and strict tenant RLS isolation.
- Run `pnpm verify` to confirm workspace compiles and all tests pass perfectly.
