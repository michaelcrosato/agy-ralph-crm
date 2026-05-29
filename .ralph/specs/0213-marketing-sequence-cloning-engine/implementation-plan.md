# Specification: Marketing Sequence Cloning & Template Copying Engine - Implementation Plan

## Step 1: Export core helper in packages/core
Add `cloneMarketingSequence(dbStore, sequenceId, newName, orgId)` to the bottom of `packages/core/src/index.ts` to manage the transaction-safe deep copy logic.

## Step 2: Implement REST API Route in apps/api
Append the `POST /api/sequences/:id/clone` route handler in `apps/api/src/index.ts` right after the folder & tag endpoints. Ensure it maps tenant context correctly and invokes the core function.

## Step 3: Write Integration Test Suite
Create `packages/testing/src/marketing-sequence-cloning.test.ts` to assert that:
- Deeps cloning copies sequence properties, steps, branches, split tests, actions, exit triggers, and tags correctly.
- RLS boundaries are strongly isolated (a tenant cannot clone another organization's campaign, even if they know the ID).
- Cloning sets the status to `"draft"`.

## Step 4: Verify Workspace
Run the verification sequence:
- `pnpm verify` to check formatting and compilation.
- `pnpm test` to verify all test suites.
