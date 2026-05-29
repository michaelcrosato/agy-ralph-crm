# Specification: Marketing Sequence Sending Schedule & Deferral Engine - Implementation Plan

## Step 1: Schema Updates
- [ ] Add `sendingWindowStart`, `sendingWindowEnd`, and `sendingDays` fields to `marketingSequences` in `packages/db/src/schema.ts`.
- [ ] Update `DBMarketingSequence` interface and database seeding/mock stores in `packages/db/src/index.ts`.

## Step 2: Core Business Logic Implementation
- [ ] Implement `getNextValidSendingTime` helper function in `packages/core/src/index.ts`.
- [ ] Update the step execution loop in `executePendingSequenceSteps` to retrieve sequence schedule, evaluate validity, and defer `nextExecutionAt` with an audit log if deferred.

## Step 3: REST API Endpoint Integration
- [ ] Add `POST /api/sequences/:id/schedule` in `apps/api/src/index.ts` to update sequence sending windows. Validate time format (`HH:MM`) and days array (1 to 7).

## Step 4: Verification & Integration Testing
- [ ] Create a comprehensive integration test suite `packages/testing/src/marketing-sequence-schedule.test.ts`.
- [ ] Test cases:
  1. Deferral on disallowed day (e.g. running on Saturday when restricted to Mon-Fri).
  2. Deferral on allowed day but outside hour window (e.g. running at 21:00 when window is 09:00 to 17:00).
  3. Immediate execution inside allowed sending window.
  4. Proper tenant RLS isolation enforcement when querying or modifying sequence schedules.
- [ ] Verify that workspace compiles and tests pass using `pnpm verify` and `pnpm test`.
