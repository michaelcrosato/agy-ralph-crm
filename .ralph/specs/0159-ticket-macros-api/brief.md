# Task 0159: Support Ticket Canned Responses & Macros Engine - Brief

## 1. Functional Objective
Support agents in high-volume customer service environments frequently encounter repetitive questions. To improve efficiency and ensure consistent communication, the CRM ticketing subsystem needs a **Support Ticket Canned Responses & Macros Engine**.

This feature allows:
1. Tenants to define reusable **Canned Responses / Macros** (`ticket_macros`) containing a name, description, standard message body, and optional ticket field updates (like setting status to "Resolved" or priority to "High").
2. Support agents to apply a macro to a ticket in a single operation, which:
   - Updates the ticket's status and priority fields if specified in the macro.
   - Appends a new ticket comment with the canned response template.
   - Records the event in the system audit logs.
3. Exposing isolated REST endpoints to manage macros and apply them under active tenant Row-Level Security (RLS).

## 2. Technical Scope
- **Database Schema**:
  - Add `ticketMacros` table to `packages/db/src/schema.ts` and update the database store mappings and `clear` function in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `applyTicketMacro` in `packages/core/src/index.ts` to process a macro application and return the updated ticket fields and canned comment body.
- **REST Endpoints**:
  - `POST /api/service/tickets/macros` - Creates a new canned response macro.
  - `GET /api/service/tickets/macros` - Lists all macros for the active tenant.
  - `POST /api/service/tickets/:id/apply-macro/:macroId` - Applies a macro to a ticket, updating its fields and inserting a ticket comment.
- **Tenant RLS & Security**:
  - All operations must run strictly within the active tenant's context (`orgId`). A tenant must never see, modify, or apply macros belonging to other organizations.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/ticket-macros.test.ts` validating macro creation, listing, applying to a ticket, RLS isolation, and audit log generation.
