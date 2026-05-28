# Phase 5: Managed First-Party Core Extensions - Design

## Database Schema (Drizzle ORM)

We will define `tickets` in `packages/db/src/schema.ts` to represent the first-party extension:

* **`tickets`**
  * `id`: uuid (primary key)
  * `orgId`: uuid (tenant link)
  * `contactId`: uuid (references contacts.id)
  * `subject`: text (non-nullable)
  * `status`: text (Open, In Progress, Resolved)
  * `createdAt`: timestamp (default now)

## Ticketing Service Contracts

In `modules/service-lite/src/index.ts`:
* Service functions to handle ticket management:
```typescript
export interface TicketInsert {
  orgId: string;
  contactId: string;
  subject: string;
}

export function createTicket(ticket: TicketInsert): { orgId: string; contactId: string; subject: string; status: string };
```

## Model Context Protocol (MCP) Tools

In `apps/api/src/index.ts`:
* Export standard JSON tool definitions for querying:
```typescript
export const mcpTools = [
  {
    name: "crm_get_account",
    description: "Retrieve CRM account details by ID under strict RLS isolation.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
      },
      required: ["accountId"],
    },
  },
];
```
