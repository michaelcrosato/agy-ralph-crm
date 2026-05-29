# Task 0162: Model Context Protocol (MCP) Ticketing Integration - Requirements

## 1. Functional Requirements

### 1.1 `crm_get_ticket` Tool
- **Input Arguments**:
  - `ticketId` (string, required): The UUID of the ticket to retrieve.
- **Output**:
  - A text block containing the JSON representation of the ticket, or `null`/error if not found under the active tenant context.
- **Security**: Must execute under strict tenant isolation. If a tenant queries another tenant's ticket, it must return `null` or a 404.

### 1.2 `crm_list_tickets` Tool
- **Input Arguments**:
  - `status` (string, optional): Filter tickets by status ("Open", "In Progress", "Resolved").
- **Output**:
  - A text block containing the JSON list of tickets belonging to the active tenant.
- **Security**: Must strictly filter by the active tenant org ID.

### 1.3 `crm_create_ticket` Tool
- **Input Arguments**:
  - `subject` (string, required)
  - `body` (string, required)
  - `email` (string, required)
  - `firstName` (string, optional)
  - `lastName` (string, optional)
  - `priority` (string, optional, default "Medium")
  - `assignedToId` (string, optional)
- **Execution Flow**:
  - Reuse the contact auto-matching logic: search for contact by `email`. If found, use `contact.id`. If not, create a new contact record with the email, firstName, and lastName (defaulting to 'Web Contact' if omitted) under RLS.
  - Evaluate active ticket assignment rules to route ownership, or fallback to the provided `assignedToId` or system fallback.
  - Insert the ticket under active tenant RLS isolation.
  - Log audit logs for the ticket and contact (if created).
  - Trigger outbound webhooks with the `ticket.created` event payload.
- **Output**:
  - JSON representation of the created ticket.

### 1.4 `crm_add_ticket_comment` Tool
- **Input Arguments**:
  - `ticketId` (string, required)
  - `body` (string, required)
  - `authorId` (string, required)
- **Execution Flow**:
  - Validate that the ticket exists and belongs to the active tenant.
  - Insert comment/reply record.
  - Log an audit trail.
- **Output**:
  - JSON representation of the created comment.

### 1.5 `crm_apply_ticket_macro` Tool
- **Input Arguments**:
  - `ticketId` (string, required)
  - `macroId` (string, required)
- **Execution Flow**:
  - Validate ticket and macro existence under RLS isolation.
  - Apply canned response body, update status, and update priority on the ticket record.
  - Insert comment with canned response and update ticket.
  - Log an audit log.
- **Output**:
  - JSON status indicating success and the updated ticket.

## 2. Non-Functional Requirements
- **Tenant Context Wrapper**: All tool executions in `POST /mcp/tools/call` run through the `tenantAuth` middleware, meaning the database operations are automatically wrapped in the tenant context.
- **Code Cleanliness**: No placeholders or TODO comments allowed. Must compile cleanly.
- **TypeScript**: Pinned to TypeScript and Node.js v22 specifications.
