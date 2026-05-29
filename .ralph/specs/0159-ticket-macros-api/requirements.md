# Task 0159: Support Ticket Canned Responses & Macros Engine - Requirements

## 1. Functional Requirements
- **Macro Definition**:
  - Support creating canned response macros with:
    - `name` (string, required, max 100 characters)
    - `description` (string, optional)
    - `cannedResponse` (string, required, the comment text template to append)
    - `updateStatus` (string, optional, the status to transition the ticket to, e.g., "Resolved")
    - `updatePriority` (string, optional, the priority to change the ticket to, e.g., "High")
- **Applying Macros**:
  - Applying a macro to a ticket must:
    - Check if the ticket and macro exist and belong to the same tenant (`orgId`).
    - Return the updated status and priority.
    - Append a comment to the ticket with the macro's canned response body.
    - Log an audit trail entry representing the macro application.

## 2. API Endpoints
- `POST /api/service/tickets/macros`
  - Creates a new macro.
  - Requires body validation: `name` and `cannedResponse` cannot be empty.
- `GET /api/service/tickets/macros`
  - Lists all macros for the active tenant.
- `POST /api/service/tickets/:id/apply-macro/:macroId`
  - Applies the specified macro to the ticket.
  - Updates the ticket's `status` and/or `priority` if configured on the macro.
  - Creates a ticket comment with the canned response.
  - Creates an audit log entry.

## 3. Row-Level Security & Isolation
- All endpoints must authenticate the active tenant using the `tenantAuth` middleware.
- Direct store queries must use `getActiveOrgId()` to enforce tenant isolation.
- Attempts to query or apply another tenant's macros or tickets must throw a strict RLS violation or return a 404/403 error.

## 4. Verification Requirements
- All code must pass Biome checks (`pnpm lint`).
- All code must compile cleanly (`pnpm typecheck`).
- Integration tests in `packages/testing/src/ticket-macros.test.ts` must pass.
