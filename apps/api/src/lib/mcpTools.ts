/** MCP tool descriptors surfaced via /mcp/tools and /mcp/tools/call. */
export const mcpTools = [
  {
    name: "crm_get_account",
    description:
      "Retrieve CRM account details by ID under strict RLS isolation.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
      },
      required: ["accountId"],
    },
  },
  {
    name: "crm_list_contacts",
    description: "List CRM contact records under active row-level security.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string" },
      },
      required: ["orgId"],
    },
  },
  {
    name: "crm_get_ticket",
    description:
      "Retrieve support ticket details by ID under strict active tenant RLS isolation.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "string" },
      },
      required: ["ticketId"],
    },
  },
  {
    name: "crm_list_tickets",
    description:
      "List all support tickets for the active tenant, with optional status filter.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["Open", "In Progress", "Resolved"] },
      },
    },
  },
  {
    name: "crm_create_ticket",
    description:
      "Create a support ticket from an AI assistant, auto-matching/creating contacts and evaluating assignment rules.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
        email: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        priority: { type: "string", enum: ["Low", "Medium", "High", "Urgent"] },
        assignedToId: { type: "string" },
      },
      required: ["subject", "body", "email"],
    },
  },
  {
    name: "crm_add_ticket_comment",
    description:
      "Add a comment/reply to a support ticket under active tenant isolation.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "string" },
        body: { type: "string" },
        authorId: { type: "string" },
      },
      required: ["ticketId", "body", "authorId"],
    },
  },
  {
    name: "crm_apply_ticket_macro",
    description:
      "Apply a canned response macro to a support ticket under active tenant isolation.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "string" },
        macroId: { type: "string" },
      },
      required: ["ticketId", "macroId"],
    },
  },
];
