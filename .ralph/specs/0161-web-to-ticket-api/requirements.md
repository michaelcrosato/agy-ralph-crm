# Task 0161: Public Web-to-Ticket Capture API - Requirements

## 1. Functional Requirements

### 1.1 Public API Endpoint
- The endpoint must be hosted at `POST /api/public/web-to-ticket`.
- The endpoint must NOT require JWT session headers or active user authorization. It must be accessible as a public API.
- The request payload must contain the following required fields:
  - `orgId` (UUID, must be a valid organization in the database)
  - `subject` (string, the ticket subject, non-empty)
  - `body` (string, description/body of the ticket, non-empty)
  - `email` (string, valid email address for contact matching/creation)
- The request payload may contain the following optional fields:
  - `firstName` (string, for new contact creation)
  - `lastName` (string, for new contact creation, defaults to "Web Contact" if not provided)
  - `priority` (string: "Low", "Medium", "High", "Urgent", defaults to "Medium")
  - `custom` (object containing dynamic custom fields for the ticket)
  - `assignedToId` (UUID, optional specific owner fallback)

### 1.2 Multi-Tenant RLS Wrapping
- The API handler must extract `orgId` from the payload, verify that the organization exists, and immediately execute all subsequent database lookups, updates, and insertions within `withTenant(orgId, mockDb, async () => { ... })`.
- All operations (e.g. searching contacts, creating contacts, evaluating assignment rules, creating tickets, and inserting audit logs) must run with RLS isolation enforced.

### 1.3 Contact Resolving Engine
- Within the RLS context, the engine must search for an existing contact with the exact `email` provided in the payload.
- If an existing contact is found:
  - Link the ticket to this contact using its `id`.
- If no contact is found:
  - Automatically insert a new contact record with `email`, `firstName` (if provided, otherwise null), `lastName` (if provided, otherwise "Web Contact"), and `orgId`.
  - Log an audit trail entry for the creation of the new contact.
  - Link the ticket to the newly created contact.

### 1.4 Ticket Routing & Assignment Engine
- Within the RLS context, the engine must look up active `ticketAssignmentRules` for the tenant.
- If an active rule is found, the engine must evaluate the ticket's properties against the sorted rule entries (`ticketAssignmentRuleEntries`) using `evaluateTicketAssignment`:
  - If a rule entry matches, assign the ticket to the determined `assignedToId`.
  - If the matching entry uses the `"round_robin"` method, update the `lastAssignedIndex` on that entry in the database.
- If no active rule matches, or if no active rules exist:
  - Assign the ticket to the provided `assignedToId` in the payload (if valid).
  - If still unassigned, fall back to a system default owner (`"user-system"` or the first user in the organization).

### 1.5 Custom Field Validation
- If `custom` fields are provided in the payload, validate them against the defined `fieldDefinitions` for the `"tickets"` object type using `validateCustomFields` from `packages/core`.
- If validation fails, return a `400 Bad Request` containing the specific validation errors.

### 1.6 Downstream Audit & Webhooks
- Insert an audit log record into `audit_logs` capturing the ticket creation action with details under the active RLS context.
- Trigger outbound webhooks with the event `ticket.created` asynchronously, passing the complete ticket payload.

## 2. Non-Functional Requirements
- **Performance**: The capture process must execute database queries sequentially under a single RLS context block.
- **Safety**: Tenant data leaks are prevented via RLS. Input fields are strictly validated before insertion.
- **Robustness**: Any non-existent `orgId` must return a clear `400` error message with no further actions taken.
