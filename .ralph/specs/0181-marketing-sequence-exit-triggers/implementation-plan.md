# Specification: Marketing Sequence Exit Triggers Engine - Implementation Plan

## Step 1: Database Schema & Store Mapping
- Edit `packages/db/src/schema.ts` to export the `marketingSequenceExitTriggers` table.
- Edit `packages/db/src/index.ts` to expose the `marketingSequenceExitTriggers` store under the main db connection context.

## Step 2: Core Domain Logic
- Edit `packages/core/src/index.ts` to define the `CoreExitTrigger` type.
- Add `shouldExitSequence` logic.
- Update `executePendingSequenceSteps` to retrieve opportunities and exit triggers, verify exit conditions, and auto-exit memberships if triggered.

## Step 3: API Endpoints
- Edit `apps/api/src/index.ts` to register REST routes:
  - `GET /api/sequences/:id/exit-triggers`
  - `POST /api/sequences/:id/exit-triggers`
  - `DELETE /api/sequences/:id/exit-triggers/:triggerId`

## Step 4: Integration Tests
- Create `packages/testing/src/marketing-sequence-exit-triggers.test.ts`.
- Run validation pipeline: `pnpm verify` and `pnpm test`.
