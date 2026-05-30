import type { TenantContext } from "../index";

export const contactSchemas = [
  {
    name: "crm_get_contact",
    description: "Retrieve contact details by ID.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "crm_list_contacts",
    description: "List contact records.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "crm_create_contact",
    description: "Create a new contact record.",
    inputSchema: {
      type: "object",
      properties: {
        ownerId: { type: "string" },
        accountId: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        custom: { type: "object" },
      },
      required: ["lastName"],
    },
  },
  {
    name: "crm_update_contact",
    description: "Update an existing contact.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        ownerId: { type: "string" },
        accountId: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        custom: { type: "object" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "crm_delete_contact",
    description: "Delete a contact by ID.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
      },
      required: ["contactId"],
    },
  },
];

export async function handleContactTool(
  name: string,
  args: any,
  dbStore: any,
  tenantContext: TenantContext,
): Promise<any> {
  switch (name) {
    case "crm_get_contact": {
      const res = await dbStore.contacts.findOne(args.contactId);
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_list_contacts": {
      const res = await dbStore.contacts.findMany();
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_create_contact": {
      const res = await dbStore.contacts.insert({
        orgId: tenantContext.orgId,
        ownerId: args.ownerId || tenantContext.userId || "user-system",
        accountId: args.accountId || null,
        firstName: args.firstName || null,
        lastName: args.lastName,
        email: args.email || null,
        custom: args.custom || null,
      });
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_update_contact": {
      const { contactId, ...updates } = args;
      const res = await dbStore.contacts.update(contactId, updates);
      return { content: [{ type: "text", text: JSON.stringify(res) }] };
    }
    case "crm_delete_contact": {
      const res = await dbStore.contacts.delete(args.contactId);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: res }) }],
      };
    }
    default:
      return undefined;
  }
}
