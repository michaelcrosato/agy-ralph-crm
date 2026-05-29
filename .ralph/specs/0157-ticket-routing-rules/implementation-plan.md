# Specification: Support Ticket Routing & Assignment Rules Engine - Implementation Plan

## Step 1: Database Schema Definitions
- Modify `packages/db/src/schema.ts` to add:
  - `assignedToId` field inside `tickets` pgTable definition.
  - `ticketAssignmentRules` pgTable definition.
  - `ticketAssignmentRuleEntries` pgTable definition.
- Modify `packages/db/src/index.ts` to add:
  - Interfaces `DBTicketAssignmentRule` and `DBTicketAssignmentRuleEntry`.
  - Add store arrays inside `store` and hook up clean function inside `dbStore.clear()`.
  - Expose mapping collections under `dbStore`.

## Step 2: Pure Domain Core Functions
- Modify `packages/core/src/index.ts` to export:
  - `evaluateTicketAssignment` evaluation function.
  - Add associated TypeScript interfaces.

## Step 3: API Endpoints
- Modify `apps/api/src/index.ts` to import `evaluateTicketAssignment` and add endpoints:
  - `POST /api/service/tickets/routing-rules`
  - `GET /api/service/tickets/routing-rules`
  - `POST /api/service/tickets/routing-rules/:id/entries`
  - `GET /api/service/tickets/routing-rules/:id/entries`
  - `POST /api/service/tickets/:id/route`
  - `PUT /api/service/tickets/:id/assign`

## Step 4: Integration & Unit Tests
- Create `packages/testing/src/ticket-routing.test.ts`.
- Write thorough tests asserting:
  - Direct ticket assignment rules routing based on subject / criteria.
  - Round-robin ticket assignment rules rotation.
  - Tenant RLS isolation.
  - Audit logging of ticket assignment transitions.

## Step 5: Verification & Run
- Execute `pnpm verify` to confirm compilation, linting, formatting, and unit tests all pass cleanly.
