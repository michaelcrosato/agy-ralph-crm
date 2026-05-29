# Task 0162: Model Context Protocol (MCP) Ticketing Integration - Brief

## 1. Functional Objective
The Model Context Protocol (MCP) server enables AI assistants to interact with the CRM. To expand our customer support ticketing capabilities, we need to implement **MCP Ticketing Integration Tools**. This allows external AI assistants or workflows to query, create, comment on, and manage support tickets via standard MCP tool calls while adhering to strict row-level security (RLS) isolation.

This feature enables:
1. **crm_get_ticket**: Retrieve full details of a specific ticket under active tenant RLS isolation.
2. **crm_list_tickets**: List all tickets matching the active tenant org, supporting basic filtering by status.
3. **crm_create_ticket**: Create a support ticket from an AI assistant. This should reuse the robust contact auto-matching/creation logic and ticket assignment rules engine established in Public Web-to-Ticket (Task 0161).
4. **crm_add_ticket_comment**: Add comments/replies to a ticket, logging audit trails and enforcing tenancy.
5. **crm_apply_ticket_macro**: Apply a ticket canned response macro to resolve or update the ticket.

## 2. Technical Scope
- **MCP Server Endpoints**:
  - `GET /mcp/tools` - Advertise the new ticket-specific tools.
  - `POST /mcp/tools/call` - Handle tool executions for `crm_get_ticket`, `crm_list_tickets`, `crm_create_ticket`, `crm_add_ticket_comment`, and `crm_apply_ticket_macro`.
- **Active Tenancy Isolation**:
  - All tools must execute under the active tenant's token/session context using the `tenantAuth` middleware, ensuring PostgreSQL RLS dynamically restricts database mutations.
- **Verification**:
  - Scaffolding a comprehensive integration suite inside `packages/testing/src/mcp-service-lite.test.ts`.
