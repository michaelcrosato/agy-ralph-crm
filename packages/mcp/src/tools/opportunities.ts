import type { TenantContext } from "../index";

export const opportunitySchemas = [
  {
    name: "crm_get_opportunity",
    description: "Retrieve opportunity details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        opportunityId: { type: "string" },
      },
      required: ["opportunityId"],
    },
  },
  {
    name: "crm_list_opportunities",
    description: "List opportunities with optional stage filter.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string" },
      },
    },
  },
  {
    name: "crm_create_opportunity",
    description: "Create a new opportunity.",
    inputSchema: {
      type: "object",
      properties: {
        ownerId: { type: "string" },
        accountId: { type: "string" },
        campaignId: { type: "string" },
        stage: { type: "string" },
        name: { type: "string" },
        amount: { type: "string" },
        closeDate: { type: "string" },
        custom: { type: "object" },
      },
      required: ["name"],
    },
  },
  {
    name: "crm_update_opportunity",
    description: "Update an existing opportunity.",
    inputSchema: {
      type: "object",
      properties: {
        opportunityId: { type: "string" },
        ownerId: { type: "string" },
        accountId: { type: "string" },
        campaignId: { type: "string" },
        stage: { type: "string" },
        name: { type: "string" },
        amount: { type: "string" },
        closeDate: { type: "string" },
        custom: { type: "object" },
      },
      required: ["opportunityId"],
    },
  },
  {
    name: "crm_delete_opportunity",
    description: "Delete an opportunity by ID.",
    inputSchema: {
      type: "object",
      properties: {
        opportunityId: { type: "string" },
      },
      required: ["opportunityId"],
    },
  },
];

export async function handleOpportunityTool(
  name: string,
  args: any,
  dbStore: any,
  tenantContext: TenantContext,
): Promise<any> {
  switch (name) {
    case "crm_get_opportunity": {
      const res = await dbStore.opportunities.findOne(args.opportunityId);
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_list_opportunities": {
      const allOpps = await dbStore.opportunities.findMany();
      const res = args.stage
        ? allOpps.filter((o: any) => o.stage === args.stage)
        : allOpps;
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_create_opportunity": {
      const res = await dbStore.opportunities.insert({
        orgId: tenantContext.orgId,
        ownerId: args.ownerId || tenantContext.userId || "user-system",
        accountId: args.accountId || null,
        campaignId: args.campaignId || null,
        stage: args.stage || "Prospecting",
        name: args.name,
        amount: args.amount || null,
        closeDate: args.closeDate ? new Date(args.closeDate) : null,
        custom: args.custom || null,
        currencyCode: "USD",
        amountCorporate: args.amount || null,
      });
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_update_opportunity": {
      const { opportunityId, ...updates } = args;
      if (updates.closeDate) {
        updates.closeDate = new Date(updates.closeDate);
      }
      const res = await dbStore.opportunities.update(opportunityId, updates);
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_delete_opportunity": {
      const res = await dbStore.opportunities.delete(args.opportunityId);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: res }) }],
      };
    }
    default:
      return undefined;
  }
}
