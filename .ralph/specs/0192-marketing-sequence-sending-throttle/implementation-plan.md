# Specification: Marketing Sequence Daily Sending Throttle Limit - Implementation Plan

We will implement this task in the following step-by-step sequence:

## Step 1: Packages Database Upgrades
1. Edit `packages/db/src/schema.ts` to add `dailySendLimit: integer("daily_send_limit")` on `marketingSequences` table.
2. Edit `packages/db/src/index.ts` to extend the `DBMarketingSequence` interface and update mock database schemas.

## Step 2: Core Logic Updates
1. Edit `packages/core/src/index.ts` to add `dailySendLimit?: number | null;` on `CoreSequence` interface.
2. Implement rolling daily sent counter logic at the start of `executePendingSequenceSteps`.
3. Add check inside the loop to defer execution if the daily send limit is met.
4. Increment the counter when a sequence step executes successfully.

## Step 3: REST API Updates
1. Update `app.post("/api/sequences")` in `apps/api/src/index.ts` to parse, validate, and persist `dailySendLimit`.
2. Update `app.post("/api/sequences/:id/schedule")` in `apps/api/src/index.ts` to parse, validate, and persist `dailySendLimit`.

## Step 4: Integration and RLS Tests
1. Create `packages/testing/src/marketing-sequence-throttle.test.ts`.
2. Implement comprehensive integration tests:
   - Create a sequence with `dailySendLimit: 1` and enroll 2 leads.
   - Run the execution loop, assert that only 1 step is executed and 1 lead's step is deferred with a `membership_schedule_deferred` audit log.
   - Verify RLS: tenant B cannot query tenant A's sequence schedule or bypass the limit.
   - Ensure the API returns 400 Bad Request on invalid limit values.
