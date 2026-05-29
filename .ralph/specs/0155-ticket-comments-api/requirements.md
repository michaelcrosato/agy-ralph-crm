# Specification: Support Ticket Comments & Replies Management Engine - Requirements

## 1. Functional Requirements

### 1.1 Ticket Comment Structure (`ticket_comments`)
- Each comment must belong to a specific tenant (`orgId`).
- Each comment must belong to a valid existing support ticket (`ticketId`).
- Each comment must have an author (`authorId`, referencing `users`).
- Each comment must contain a non-empty `body` text.
- Each comment must have a creation timestamp (`createdAt`).

### 1.2 Validation Rules
- The comment body must not be empty or consist only of whitespace.
- Attempting to post a comment to a non-existent ticket, or a ticket belonging to another tenant, must fail.

### 1.3 REST API Surface
- **Post Comment**:
  - `POST /api/service/tickets/:id/comments` - Payload: `{ body: string }`.
  - Automatically sets `authorId` to the active user ID, sets `orgId` to the active tenant ID, and sets `ticketId` to the route parameter `:id`.
  - Returns the created comment.
- **List Comments**:
  - `GET /api/service/tickets/:id/comments` - Returns all comments for the ticket, sorted chronologically (oldest first).

### 1.4 Tenant Isolation & RLS
- All database operations must strictly verify the active tenant ID (`orgId`) via `AsyncLocalStorage` and `getActiveOrgId()`.
- Tenants must never be able to access, view, or write comments for tickets belonging to another organization.

### 1.5 Audit Trails
- Posting a comment must log an audit entry in the `auditLogs` table.

## 2. Technical Constraints
- Pure logic functions in `packages/core` must be fully type-safe.
- TypeScript type-checking must pass cleanly with zero warnings or `any` workarounds.
- Lint and formatting must pass Biome checks.
