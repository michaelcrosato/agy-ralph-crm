# Specification: Support Ticketing & MCP Execution Engine - Requirements

## Functional Requirements
1. **Support Ticketing API Endpoints:**
   - `POST /api/tickets` - Creates a new support ticket linking to a contact. Uses `@crm/module-service-lite`'s `createTicket`.
   - `GET /api/tickets` - Lists all support tickets for the active tenant under RLS isolation.
   - `POST /api/tickets/:id/resolve` - Resolves the support ticket status using `@crm/module-service-lite`'s `resolveTicket`.
2. **MCP Tool Execution API:**
   - `POST /mcp/tools/call` - Protected by tenant authentication. Executes a named MCP tool and returns a JSON payload compliant with Model Context Protocol standards.
   - Tool `crm_get_account` - Queries and returns the account matched by `accountId` under active tenant RLS context.
   - Tool `crm_list_contacts` - Queries and lists contacts registered for the calling tenant.

## Verification Requirements
1. **Extension & MCP Engine Tests:**
   - Verify that non-authenticated MCP requests are blocked.
   - Verify that `crm_get_account` is executed successfully by a tenant for their own account, and returns null/error when querying another tenant's account.
   - Verify support ticket lifecycle (create, list, resolve) passes under correct tenant limits.
2. **TypeScript & Biome Standards:**
   - The entire codebase must compile and lint perfectly.
