# Specification: Support Ticketing & MCP Execution Engine - Implementation Plan

## Code Generation Sequence

### Step 1: Database Support Tickets Store
Add `tickets` table interface and RLS find/insert/update operations to `dbStore` inside `packages/db/src/index.ts`.

### Step 2: REST Support Ticketing Endpoints
Implement support ticketing routes inside `apps/api/src/index.ts`:
- `POST /api/tickets` (register support ticket using `@crm/module-service-lite`'s `createTicket`)
- `GET /api/tickets` (list support tickets under tenant context)
- `POST /api/tickets/:id/resolve` (resolve support ticket using `@crm/module-service-lite`'s `resolveTicket`)

### Step 3: REST MCP Execution Endpoints
Implement `/mcp/tools/call` route inside `apps/api/src/index.ts` to allow dynamic execution of MCP tools `crm_get_account` and `crm_list_contacts` with full database RLS context active.

### Step 4: Verification Testing
Create `packages/testing/src/mcp-and-ticketing.test.ts` to assert that registered support tickets transition status correctly and MCP tools return isolated results strictly adhering to the calling tenant's RLS boundaries.
