# Task 0161: Public Web-to-Ticket Capture API - Brief

## 1. Functional Objective
External customers and web forms need a secure, unauthenticated way to submit support requests directly to the CRM's ticketing subsystem. To support this, we need to implement a **Public Web-to-Ticket Capture API**.

This feature enables:
1. Public, unauthenticated ticket submission at `POST /api/public/web-to-ticket`.
2. Automatic mapping/linking of the ticket to a contact inside the target organization. If a contact with the provided `email` already exists, we link the ticket to them. If no such contact exists, we automatically create a new contact under that organization using the provided `email`, `firstName`, and `lastName`, and link the ticket to it.
3. Automatically running **Ticket Assignment Rules** (implemented in Task 0157) on the new ticket to route it to the appropriate user (either direct or round-robin), updating the last assigned index. If no assignment rules match, fallback to the provided `assignedToId` in the request, or the system fallback.
4. Performing custom field validation if `custom` fields are provided in the payload (against definitions for the `tickets` object type).
5. Logging a detailed, immutable audit log record for both the contact creation (if created) and the ticket creation under the active tenant's context.
6. Triggering outbound webhooks with the event `ticket.created` asynchronously.
7. Protecting all database queries and mutations under strict active tenant isolation (RLS) dynamically using the target `orgId`.

## 2. Technical Scope
- **REST Endpoints**:
  - `POST /api/public/web-to-ticket` - Public, unauthenticated endpoint.
- **Active Tenancy Isolation**:
  - Automatically wrap the database operations inside `withTenant(orgId, mockDb, async () => { ... })` to enforce RLS boundaries.
- **Contact Matching & Auto-Creation**:
  - Check for existing contacts by `email`. If found, use `contact.id`. If not, insert a new contact record with `email`, `firstName` (optional), and `lastName` (optional or default) under RLS.
- **Ticket Assignment Engine Integration**:
  - Query and evaluate active `ticketAssignmentRules` and `ticketAssignmentRuleEntries` for the target tenant. If rules match, assign the ticket to the routed user and update the round-robin last assigned index.
- **Validation**:
  - Ensure `orgId`, `subject`, `body`, and contact contact identifiers (e.g. `email`) are present.
  - If `custom` fields are provided, validate them against defined field definitions for the `tickets` object type.
- **Downstream Actions**:
  - Log audit trails.
  - Trigger outbound webhooks with `ticket.created` event payload.
- **Verification**:
  - Write complete integration tests inside `packages/testing/src/web-to-ticket.test.ts`.
