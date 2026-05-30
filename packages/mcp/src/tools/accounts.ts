import type { TenantContext } from "../index";

export const accountSchemas = [
  {
    name: "crm_get_account",
    description: "Retrieve CRM account details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
      },
      required: ["accountId"],
    },
  },
  {
    name: "crm_list_accounts",
    description: "List all account records.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "crm_create_account",
    description: "Create a new account.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        domain: { type: "string" },
        custom: { type: "object" },
      },
      required: ["name"],
    },
  },
  {
    name: "crm_update_account",
    description: "Update an existing account.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
        name: { type: "string" },
        domain: { type: "string" },
        custom: { type: "object" },
      },
      required: ["accountId"],
    },
  },
  {
    name: "crm_delete_account",
    description: "Delete an account by ID.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
      },
      required: ["accountId"],
    },
  },
];

export async function handleAccountTool(
  name: string,
  args: any,
  dbStore: any,
  tenantContext: TenantContext,
): Promise<any> {
  switch (name) {
    case "crm_get_account": {
      const res = await dbStore.accounts.findOne(args.accountId);
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_list_accounts": {
      const res = await dbStore.accounts.findMany();
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_create_account": {
      const res = await dbStore.accounts.insert({
        orgId: tenantContext.orgId,
        ownerId: args.ownerId || tenantContext.userId || "user-system",
        name: args.name,
        domain: args.domain || null,
        custom: args.custom || null,
        parentAccountId: null,
      });
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_update_account": {
      const { accountId, ...updates } = args;
      const res = await dbStore.accounts.update(accountId, updates);
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_delete_account": {
      const res = await dbStore.accounts.delete(args.accountId);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: res }) }],
      };
    }
    default:
      return undefined;
  }
}
