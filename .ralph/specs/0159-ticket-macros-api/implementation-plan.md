# Task 0159: Support Ticket Canned Responses & Macros Engine - Implementation Plan

## Step 1: Database Schema & Store Extension
1. Open `packages/db/src/schema.ts` and append `ticketMacros` schema table definition.
2. Open `packages/db/src/index.ts`:
   - Declare `DBTicketMacro` interface.
   - Extend the global in-memory `store` type/variable to include `ticketMacros`.
   - Implement `dbStore.ticketMacros` CRUD methods (`findMany`, `findById`, `create`, `update`, `delete`) respecting `getActiveOrgId()` RLS constraints.
   - Reset `store.ticketMacros` in `dbStore.clear()`.

## Step 2: Core Business Logic
1. Open `packages/core/src/index.ts`.
2. Define the pure function `applyTicketMacro` and validation functions for canned responses/macros input.
3. Export new interfaces and functions.

## Step 3: REST API Endpoints
1. Open `apps/api/src/index.ts`.
2. Implement endpoints:
   - `POST /api/service/tickets/macros`
   - `GET /api/service/tickets/macros`
   - `POST /api/service/tickets/:id/apply-macro/:macroId`
3. Wire up RLS tenant isolation checks.

## Step 4: Write Integration & RLS Tests
1. Create `packages/testing/src/ticket-macros.test.ts`.
2. Add tests verifying macro CRUD, correct execution of field updates, auto-comment appends, RLS isolation (tenant org mismatch checks), and audit trail records.

## Step 5: Verification & Compilation
1. Run `pnpm verify` to check Biome linting, formatting, and TypeScript compilation.
2. Run `pnpm test` to verify Vitest tests.
3. Commit everything to Git and exit the loop.
