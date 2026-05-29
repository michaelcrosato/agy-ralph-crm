# Specification: Support Ticket Tags & Categorization Engine - Brief

## 1. Functional Objective
Customer support teams require the ability to tag and categorize support tickets (e.g., "bug", "billing", "high-priority") to enable efficient filtering, sorting, and queue management.

This feature introduces the **Support Ticket Tags & Categorization Engine** under the `service-lite` module. The system will:
1. Allow tenants to define and manage unique tags with custom hex colors (`ticket_tags`).
2. Allow support agents to link tags to specific support tickets via a link table (`ticket_tag_links`).
3. Expose REST endpoints to manage tags and link/unlink them from tickets under strict active tenant Row-Level Security (RLS) isolation.
4. Generate audit trails when tags are created, linked, or unlinked.

## 2. Technical Scope
- **Database Schema**:
  - Add `ticketTags` and `ticketTagLinks` tables to `packages/db/src/schema.ts` and update the database store mappings and `clear` function in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `validateTicketTagInput` in `packages/core/src/index.ts` to validate that the tag name is non-empty, and the color is a valid 6-character hex string.
- **REST Endpoints**:
  - `POST /api/service/tags` - Creates a new tag for the active tenant.
  - `GET /api/service/tags` - Returns all tags defined for the active tenant.
  - `POST /api/service/tickets/:id/tags` - Links a tag to a support ticket.
  - `DELETE /api/service/tickets/:id/tags/:tagId` - Unlinks a tag from a support ticket.
  - `GET /api/service/tickets/:id/tags` - Lists all tags associated with a specific ticket.
- **Tenant RLS & Security**:
  - All operations must run strictly within the active tenant's context (`orgId`). A tenant must never see, modify, or link tags/tickets belonging to another organization.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/ticket-tags.test.ts` validating tag creation, linking, duplicate prevention, and tenant RLS isolation.
