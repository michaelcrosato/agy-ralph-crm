# Specification: Marketing Sequence Archiving & Deletion Engine - Implementation Plan

## Step 1: Implement Core Logic and Guards in packages/core
- Open `packages/core/src/index.ts`.
- Locate `enrollInSequence` and add the archived sequence guard:
  ```typescript
  if (seq.status === "archived") {
    throw new Error("Cannot enroll in an archived sequence");
  }
  ```
- Add `archiveMarketingSequence(dbStore, sequenceId, orgId)` and `purgeMarketingSequence(dbStore, sequenceId, orgId)` to the bottom of the file.

## Step 2: Register REST APIs in apps/api
- Open `apps/api/src/index.ts`.
- Import the new core functions `archiveMarketingSequence` and `purgeMarketingSequence` from `@crm/core` at the top of the file.
- Register `POST /api/sequences/:id/archive` route handler to execute `archiveMarketingSequence` under tenant RLS context.
- Register `DELETE /api/sequences/:id/purge` route handler to execute `purgeMarketingSequence` under tenant RLS context.

## Step 3: Write Comprehensive Integration Tests
- Create a new integration test file `packages/testing/src/marketing-sequence-archiving.test.ts`.
- Test scenarios:
  - Archiving a sequence updates status to `"archived"` and completes all `"active"` or `"paused"` memberships.
  - Enrolling in an archived sequence throws an error.
  - Purging a sequence successfully deletes all child records and the sequence itself.
  - Attempting to purge a non-archived sequence (e.g. `"draft"`) fails with validation error.
  - Strong multi-tenant RLS isolation: one tenant cannot archive/purge another's sequence or view/edit memberships, returning `404 Not Found` if they try.

## Step 4: Verification Gate
- Run `pnpm verify` to check compilation, formatting, and linting.
- Run `npx vitest run packages/testing/src/marketing-sequence-archiving.test.ts` to ensure the new test suite passes.
