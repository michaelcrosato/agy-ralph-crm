# Specification: Marketing Sequences & Drip Journeys API - Implementation Plan

## 1. Phase 1: Database Updates
- Modify `packages/db/src/schema.ts` to add `marketingSequences`, `marketingSequenceSteps`, and `marketingSequenceMemberships` Drizzle tables.
- Modify `packages/db/src/index.ts`:
  - Export types `DBMarketingSequence`, `DBMarketingSequenceStep`, `DBMarketingSequenceMembership`.
  - Add arrays to internal `store` object.
  - Implement full tenant-isolated CRUD stubs under `dbStore`.
  - Add array resets to `dbStore.clear()`.

## 2. Phase 2: Core Sequences Engine
- Implement core helper methods in `packages/core/src/index.ts` or in sequence helpers:
  - `enrollInSequence(sequenceId, recordType, recordId)`: Inserts dynamic enrollment, setting `nextExecutionAt` based on Step 1 wait days.
  - `executePendingSequenceSteps()`: Main loop matching memberships where `nextExecutionAt` <= current time. Validates consent opt-out, replaces template tokens, logs outbound activity, and updates progress wait times.

## 3. Phase 3: Hono API Routes
- Register new sequence REST routes in `apps/api/src/index.ts`:
  - `POST /api/sequences`
  - `POST /api/sequences/:id/steps`
  - `POST /api/sequences/:id/enroll`
  - `POST /api/sequences/execute`
  - `GET /api/sequences/:id/members`
- Ensure perfect tenant RLS validation on each input and output parameter.

## 4. Phase 4: Verification Suite
- Create integration test file `packages/testing/src/marketing-sequences.test.ts`.
- Run validation checks `pnpm verify` to confirm Typescript builds, Biome linter, and all Vitest suites run successfully.
