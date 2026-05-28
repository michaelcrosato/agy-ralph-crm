# Phase 2: Primitive Record Core & Event Timelines - Implementation Plan

## Code Generation Steps

### Step 1: Database Table Extensions
Modify `packages/db/src/schema.ts` to add the core tables:
* `accounts`
* `contacts`
* `leads`
* `opportunities`
* `auditLogs`

Export all schemas cleanly from `packages/db/src/index.ts`.

### Step 2: Lead Conversion Core Service
Implement the lead conversion function inside `packages/core/src/index.ts`. It takes a lead record and maps it to account, contact, and opportunity structures.

### Step 3: Change Auditing Logger
Implement standard helper methods inside `packages/audit/src/index.ts` to format and insert record updates/inserts into `auditLogs`.

### Step 4: Verification Tests
Create `packages/testing/src/lead.test.ts` to run and verify that lead conversions successfully instantiate accounts, contacts, and opportunities, while creating perfect chronological audit trails.

### Step 5: Verify & Push
Run `pnpm verify` and `pnpm test` to ensure that Phase 2 compiles and executes with perfect coverage.
