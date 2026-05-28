# Phase 4: Workflow Engine & External Interface Integration - Implementation Plan

## Code Generation Steps

### Step 1: Database Table Extensions
Modify `packages/db/src/schema.ts` to add the core tables:
* `workflows`
* `webhooks`

Export all schemas cleanly from `packages/db/src/index.ts`.

### Step 2: ECA Engine Processor
Implement the workflow validation and action processors inside `packages/workflow/src/index.ts`. It parses payload parameters, validates conditions, and triggers actions.

### Step 3: Outbound Mocking gateway
Implement mock gateways inside `packages/workflow/src/index.ts` to represent webhook dispatchers and notification triggers.

### Step 4: Verification Tests
Create `packages/testing/src/workflow.test.ts` to test that changing a sales stage to "Closed Won" correctly dispatches webhooks and notifies users.

### Step 5: Verify & Push
Run `pnpm verify` and `pnpm test` to ensure Phase 4 compiles and executes cleanly.
