# Specification: Marketing Sequence Email Threading - Implementation Plan

## Step 1: Database Model Upgrades
1. Edit [schema.ts](file:///C:/dev/agy-ralph-crm/packages/db/src/schema.ts):
   - Add `replyToStepNumber` to the `marketingSequenceSteps` table schema definition.
2. Edit [index.ts](file:///C:/dev/agy-ralph-crm/packages/db/src/index.ts):
   - Add `replyToStepNumber?: number | null;` to `DBMarketingSequenceStep` interface.
   - Update `marketingSequenceSteps` mock CRUD and seeding handlers to process `replyToStepNumber`.

## Step 2: Core Worker Engine Upgrades
1. Edit [index.ts](file:///C:/dev/agy-ralph-crm/packages/core/src/index.ts):
   - In `executePendingSequenceSteps`, when executing a step, resolve the parent step activity if `replyToStepNumber` is present.
   - Update the generated email subject to include the `"Re: "` prefix.
   - Populate `parent_activity_id` in the `custom` attributes of the newly created activity.

## Step 3: REST API Upgrades
1. Edit [index.ts](file:///C:/dev/agy-ralph-crm/apps/api/src/index.ts):
   - In `/api/sequences/:id/steps` (or step creation/update endpoints), add validation checking for `replyToStepNumber`.
   - Verify it is strictly less than the current step's `stepNumber` and points to an existing step in the sequence.

## Step 4: Verification and Test Suite
1. Create [marketing-sequence-threading.test.ts](file:///C:/dev/agy-ralph-crm/packages/testing/src/marketing-sequence-threading.test.ts):
   - Verify step sequence execution threads emails correctly.
   - Verify RLS boundaries are enforced.
   - Run `pnpm verify` to confirm workspace compiles cleanly and all test suites pass.
