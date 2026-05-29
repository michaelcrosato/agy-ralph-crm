# Specification: Marketing Sequence Email Open Triggers - Implementation Plan

## Step 1: Database and Types Implementation
- Add `marketingSequenceOpenActions` table definition to `packages/db/src/schema.ts` and export it.
- In `packages/db/src/index.ts`:
  - Define `DBMarketingSequenceOpenAction` interface.
  - Add `marketingSequenceOpenActions: [] as DBMarketingSequenceOpenAction[]` to the in-memory store.
  - Implement RLS-safe methods under `marketingSequenceOpenActions` (e.g. `findForStep`, `findOne`, `insert`, `delete`).
  - Clear `marketingSequenceOpenActions` array inside the `clear()` utility.

## Step 2: Core Logic Implementation
- In `packages/core/src/index.ts`:
  - Implement `processSequenceEmailOpen(dbStore, orgId, activityId, currentTime)` to resolve the sequence membership, current step, match configured open actions, execute them, and write audit trails.

## Step 3: API Gateway Endpoints Hookup
- In `apps/api/src/index.ts`:
  - In `app.get("/api/public/emails/track/open/:token")`, hook up `processSequenceEmailOpen(...)` right after the open tracker increments its count.
  - Implement GET, POST, and DELETE Hono routes under `/api/sequences/steps/.../open-actions` mimicking the link action routes.

## Step 4: Integration and RLS Tests
- Create `packages/testing/src/marketing-sequence-open-triggers.test.ts` containing comprehensive integration tests that verify open actions configuration, execution, task creation, field updates, and strict tenant RLS isolation.
