# Specification: Marketing Sequence Dynamic Branching & Event Paths - Implementation Plan

## Step 1: Database Schema Addition
- Modify `packages/db/src/schema.ts` to add the `marketingSequenceStepBranches` table.
- Export the table and run/compile.

## Step 2: Database Store Linkage
- Update `packages/db/src/index.ts` to expose `marketingSequenceStepBranches` in the Drizzle DB store wrapper.
- Export `marketingSequenceStepBranches` under standard CRUD operations:
  - `findOne(id)`
  - `findForStep(stepId)`
  - `insert(item)`
  - `update(id, updates)`
  - `delete(id)`

## Step 3: Core Logic Upgrades
- Update `packages/core/src/index.ts` to:
  - Declare the `CoreStepBranch` interface.
  - Upgrade `executePendingSequenceSteps` to support branch lookup and conditional routing based on email tracking engagement metrics.

## Step 4: REST API Implementation
- Update `apps/api/src/index.ts` to introduce Hono endpoints `/api/sequences/:id/steps/:stepId/branch` supporting GET, POST, and DELETE requests under proper tenant Org RLS context.

## Step 5: Testing & Verification
- Create `packages/testing/src/marketing-sequence-branching.test.ts` to assert:
  - Branch configuration storage and tenant RLS isolation.
  - Active branching routing behavior (both positive path and negative path).
  - Proper email tracker event evaluation and scheduling.
  - Run verification gate using `pnpm verify` and `pnpm test`.
