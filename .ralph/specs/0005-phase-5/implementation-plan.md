# Phase 5: Managed First-Party Core Extensions - Implementation Plan

## Code Generation Steps

### Step 1: Database Table Extensions
Modify `packages/db/src/schema.ts` to add the core table:
* `tickets`

Export all schemas cleanly from `packages/db/src/index.ts`.

### Step 2: Service-Lite Ticketing Engine
Implement basic ticketing creation and resolution models inside `modules/service-lite/src/index.ts`.

### Step 3: MCP Tool Spec Definitions
Implement standardized MCP lookup tool definitions in `apps/api/src/index.ts`.

### Step 4: Verification Tests
Create `packages/testing/src/extension.test.ts` to verify that ticketing functions in `service-lite` operate seamlessly without modifications to core CRM code, and that MCP tools compile correctly.

### Step 5: Verify & Push
Run `pnpm verify` and `pnpm test` to ensure Phase 5 compiles and executes cleanly.
