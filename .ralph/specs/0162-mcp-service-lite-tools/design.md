# Task 0162: Model Context Protocol (MCP) Ticketing Integration - Design

## 1. Schema & Contracts

### 1.1 MCP Tool Definitions
The `mcpTools` array in `apps/api/src/index.ts` will be extended with:

```typescript
{
  name: "crm_get_ticket",
  description: "Retrieve a support ticket by ID under strict active tenant RLS isolation.",
  inputSchema: {
    type: "object",
    properties: {
      ticketId: { type: "string" }
    },
    required: ["ticketId"]
  }
},
{
  name: "crm_list_tickets",
  description: "List all support tickets for the active tenant, with optional status filter.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["Open", "In Progress", "Resolved"] }
    }
  }
},
{
  name: "crm_create_ticket",
  description: "Create a support ticket, auto-matching/creating contacts and evaluating assignment rules.",
  inputSchema: {
    type: "object",
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
      email: { type: "string" },
      firstName: { type: "string" },
      lastName: { type: "string" },
      priority: { type: "string", enum: ["Low", "Medium", "High", "Urgent"] },
      assignedToId: { type: "string" }
    },
    required: ["subject", "body", "email"]
  }
},
{
  name: "crm_add_ticket_comment",
  description: "Add a comment/reply to a support ticket under active tenant isolation.",
  inputSchema: {
    type: "object",
    properties: {
      ticketId: { type: "string" },
      body: { type: "string" },
      authorId: { type: "string" }
    },
    required: ["ticketId", "body", "authorId"]
  }
},
{
  name: "crm_apply_ticket_macro",
  description: "Apply a canned response macro to a support ticket under active tenant isolation.",
  inputSchema: {
    type: "object",
    properties: {
      ticketId: { type: "string" },
      macroId: { type: "string" }
    },
    required: ["ticketId", "macroId"]
  }
}
```

## 2. API Endpoint Hooking
All MCP calls are routed through the existing authenticated route:
`POST /mcp/tools/call`

```typescript
// apps/api/src/index.ts
app.post("/mcp/tools/call", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, arguments: args } = body;

  // Handle crm_get_ticket, crm_list_tickets, crm_create_ticket, crm_add_ticket_comment, crm_apply_ticket_macro...
});
```

Because `tenantAuth` already wraps execution under `withTenant(orgId, mockDb, ...)`, database queries are secure by default.
- **crm_get_ticket**: `const ticket = await dbStore.tickets.findOne(ticketId);`
- **crm_list_tickets**: `const tickets = await dbStore.tickets.findMany(); // automatically filtered by orgId in RLS`
- **crm_create_ticket**: Reuse logic from `POST /api/public/web-to-ticket`, but within the authenticated tenant context of `tenant.orgId`.
- **crm_add_ticket_comment**: Check ticket existence under tenant. Insert comment using `dbStore.ticketComments.insert` and add audit log.
- **crm_apply_ticket_macro**: Check ticket and macro under tenant. Use `applyTicketMacro` or update status, priority, and insert canned comment. Log audit logs.
