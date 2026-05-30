import type { TenantContext } from "../index";

export const leadSchemas = [
  {
    name: "crm_get_lead",
    description: "Retrieve lead details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        leadId: { type: "string" },
      },
      required: ["leadId"],
    },
  },
  {
    name: "crm_list_leads",
    description: "List lead records with optional status filter.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
      },
    },
  },
  {
    name: "crm_create_lead",
    description: "Create a new lead.",
    inputSchema: {
      type: "object",
      properties: {
        ownerId: { type: "string" },
        status: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
        custom: { type: "object" },
      },
    },
  },
  {
    name: "crm_update_lead",
    description: "Update an existing lead.",
    inputSchema: {
      type: "object",
      properties: {
        leadId: { type: "string" },
        ownerId: { type: "string" },
        status: { type: "string" },
        email: { type: "string" },
        company: { type: "string" },
        custom: { type: "object" },
      },
      required: ["leadId"],
    },
  },
  {
    name: "crm_delete_lead",
    description: "Delete a lead by ID.",
    inputSchema: {
      type: "object",
      properties: {
        leadId: { type: "string" },
      },
      required: ["leadId"],
    },
  },
];

export async function handleLeadTool(
  name: string,
  args: any,
  dbStore: any,
  tenantContext: TenantContext,
): Promise<any> {
  switch (name) {
    case "crm_get_lead": {
      const res = await dbStore.leads.findOne(args.leadId);
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_list_leads": {
      const allLeads = await dbStore.leads.findMany();
      const res = args.status
        ? allLeads.filter((l: any) => l.status === args.status)
        : allLeads;
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_create_lead": {
      const res = await dbStore.leads.insert({
        orgId: tenantContext.orgId,
        ownerId: args.ownerId || tenantContext.userId || "user-system",
        status: args.status || "New",
        email: args.email || null,
        company: args.company || "Self",
        custom: args.custom || null,
        convertedAccountId: null,
        convertedContactId: null,
      });
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_update_lead": {
      const { leadId, ...updates } = args;
      const res = await dbStore.leads.update(leadId, updates);
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_delete_lead": {
      const res = await dbStore.leads.delete(args.leadId);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: res }) }],
      };
    }
    default:
      return undefined;
  }
}
