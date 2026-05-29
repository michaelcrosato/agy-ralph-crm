# Specification: Marketing Sequence Step Wait Conditions - Implementation Plan

## Step 1: Database Layer Upgrades
1. Update `packages/db/src/schema.ts` to add `waitCondition` JSONB column in `marketingSequenceSteps` table.
2. Update mock types and initialization parameters in `packages/db/src/index.ts` to include `waitCondition`.

## Step 2: Core Domain Logic Upgrades
1. Update `packages/core/src/index.ts` to add `waitCondition` to the `CoreSequenceStep` type.
2. Implement the utility `calculateNextStepExecutionTime` in `packages/core/src/index.ts`.
3. Integrate this function inside the step scheduling logic of `executePendingSequenceSteps`.

## Step 3: REST API Endpoint Layer
1. Update step creation `/api/sequences/:id/steps` route in `apps/api/src/index.ts` to capture and validate `waitCondition`.

## Step 4: Integration & RLS Tests
1. Write comprehensive tests in `packages/testing/src/marketing-sequence-wait-conditions.test.ts` asserting wait condition solver calculations, REST serialization, active tenant isolation, and audit logs.
