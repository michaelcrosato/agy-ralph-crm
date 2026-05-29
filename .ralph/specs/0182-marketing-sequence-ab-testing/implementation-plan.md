# Specification: Marketing Sequence A/B Split Testing Engine - Implementation Plan

## Step 1: Database Schema & Store Mapping
- Edit `packages/db/src/schema.ts` to export the new tables `marketingSequenceStepSplitTests` and `marketingSequenceAbAllocations`.
- Edit `packages/db/src/index.ts` to export types, store arrays, and implement helper methods for the new tables under the main db connection context.

## Step 2: Core Domain Logic
- Edit `packages/core/src/index.ts` to declare split test and allocation structures.
- Update `executePendingSequenceSteps` to integrate split test routing, randomized allocation, persistence, and variant email dispatch.

## Step 3: API Endpoints
- Edit `apps/api/src/index.ts` to register REST routes:
  - `GET /api/sequences/:id/steps/:stepId/split-test`
  - `POST /api/sequences/:id/steps/:stepId/split-test`
  - `POST /api/sequences/:id/steps/:stepId/split-test/allocate`

## Step 4: Integration Tests
- Create `packages/testing/src/marketing-sequence-ab-testing.test.ts`.
- Run validation pipeline: `pnpm verify` and `pnpm test`.
