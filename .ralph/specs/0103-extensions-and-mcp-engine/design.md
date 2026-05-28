# Specification: Support Ticketing & MCP Execution Engine - Design

## Database Storage Expansion
We will expand the in-memory `dbStore` inside `packages/db/src/index.ts` to include:
- `tickets` persistent array storing `DBTicket`:
  ```typescript
  export interface DBTicket {
    id: string;
    orgId: string;
    contactId: string;
    subject: string;
    status: "Open" | "In Progress" | "Resolved";
    createdAt: Date;
  }
  ```
- Standard RLS isolation find/insert/update methods on `dbStore.tickets`.

## MCP Tool Execution Flow
We will declare `POST /mcp/tools/call` route:
- Authenticated via `tenantAuth`.
- Payload: `{ name: string, arguments: { accountId?: string } }`
- Logic:
  - If `name === "crm_get_account"`:
    1. Retrieve `accountId` from arguments.
    2. Query `dbStore.accounts.findOne(accountId)`.
    3. If found, return MCP content format: `{ content: [{ type: "text", text: JSON.stringify(account) }] }`.
  - If `name === "crm_list_contacts"`:
    1. Query `dbStore.contacts.findMany()`.
    2. Return: `{ content: [{ type: "text", text: JSON.stringify(contacts) }] }`.
  - Else, return `400` Bad Request error "Unknown tool".
