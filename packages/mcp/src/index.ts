import { applyTicketMacro, evaluateTicketAssignment } from "@crm/core";
import { mockDb, pgDb, withTenant } from "@crm/db";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export interface TenantContext {
  orgId: string;
  userId?: string;
}

export interface McpServerOptions {
  tenantContext: TenantContext;
  dbStore: any;
  onActivityTriggered?: (
    orgId: string,
    event: string,
    payload: any,
  ) => Promise<void>;
}

export function createMcpServer(options: McpServerOptions) {
  const { tenantContext, dbStore } = options;
  const db = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;

  const server = new Server(
    {
      name: "crm-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  // Helper to wrap handlers with strict tenant RLS isolation
  const wrap = <T>(fn: () => Promise<T>): Promise<T> => {
    return withTenant(tenantContext.orgId, db as any, fn);
  };

  // 1. Tool Schemas List
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const staticTools = [
      // ACCOUNTS
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

      // CONTACTS
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

      // LEADS
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

      // OPPORTUNITIES
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

      // TICKETS
      {
        name: "crm_get_ticket",
        description: "Retrieve ticket details by ID.",
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
        description: "List tickets with optional status filter.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string" },
          },
        },
      },
      {
        name: "crm_create_ticket",
        description:
          "Create a support ticket from an AI assistant, auto-matching contacts and running assignment.",
        inputSchema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
            email: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            priority: {
              type: "string",
              enum: ["Low", "Medium", "High", "Urgent"],
            },
            assignedToId: { type: "string" },
          },
          required: ["subject", "body", "email"],
        },
      },
      {
        name: "crm_add_ticket_comment",
        description: "Add a comment/reply to a support ticket.",
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
        description: "Apply a canned response macro to a support ticket.",
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

    const customTypes = await wrap(async () =>
      dbStore.customEntityTypes.findMany(),
    );
    const dynamicTools: any[] = [];

    function mapFieldToSchema(field: any) {
      switch (field.type) {
        case "string":
        case "rich_text":
          return { type: "string" };
        case "number":
          return { type: "number" };
        case "boolean":
          return { type: "boolean" };
        case "date":
          return { type: "string", description: "ISO date string" };
        case "lookup":
          return {
            type: "object",
            properties: {
              entity_type: { type: "string" },
              entity_id: { type: "string" },
            },
            required: ["entity_type", "entity_id"],
          };
        case "picklist":
          return { type: "string", enum: field.options || [] };
        case "multi_picklist":
          return {
            type: "array",
            items: { type: "string", enum: field.options || [] },
          };
        default:
          return { type: "string" };
      }
    }

    for (const customType of customTypes) {
      const objName = customType.name.toLowerCase();
      const properties: Record<string, any> = {};
      const required: string[] = [];
      for (const field of customType.fieldsJson) {
        properties[field.apiName] = mapFieldToSchema(field);
        if (field.required) {
          required.push(field.apiName);
        }
      }

      dynamicTools.push(
        {
          name: `crm_get_${objName}`,
          description: `Retrieve ${customType.name} custom record details by ID.`,
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
            required: ["id"],
          },
        },
        {
          name: `crm_list_${objName}`,
          description: `List all ${customType.name} custom records.`,
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: `crm_create_${objName}`,
          description: `Create a new ${customType.name} custom record.`,
          inputSchema: {
            type: "object",
            properties,
            ...(required.length > 0 ? { required } : {}),
          },
        },
        {
          name: `crm_update_${objName}`,
          description: `Update an existing ${customType.name} custom record.`,
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string" },
              ...properties,
            },
            required: ["id"],
          },
        },
        {
          name: `crm_delete_${objName}`,
          description: `Delete a ${customType.name} custom record by ID.`,
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
            required: ["id"],
          },
        },
      );
    }

    return {
      tools: [...staticTools, ...dynamicTools],
    };
  });

  // 2. Tool Execution handlers
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments || {}) as any;

    return await wrap(async () => {
      switch (name) {
        // --- ACCOUNTS ---
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

        // --- CONTACTS ---
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

        // --- LEADS ---
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

        // --- OPPORTUNITIES ---
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
          const res = await dbStore.opportunities.update(
            opportunityId,
            updates,
          );
          return { content: [{ type: "text", text: JSON.stringify(res) }] };
        }
        case "crm_delete_opportunity": {
          const res = await dbStore.opportunities.delete(args.opportunityId);
          return {
            content: [{ type: "text", text: JSON.stringify({ success: res }) }],
          };
        }

        // --- TICKETS & SUPPORT ---
        case "crm_get_ticket": {
          const res = await dbStore.tickets.findOne(args.ticketId);
          return { content: [{ type: "text", text: JSON.stringify(res) }] };
        }
        case "crm_list_tickets": {
          const allTickets = await dbStore.tickets.findMany();
          const res = args.status
            ? allTickets.filter((t: any) => t.status === args.status)
            : allTickets;
          return { content: [{ type: "text", text: JSON.stringify(res) }] };
        }
        case "crm_create_ticket": {
          const {
            subject,
            body,
            email,
            firstName,
            lastName,
            priority,
            assignedToId,
          } = args;
          const orgId = tenantContext.orgId;

          let contactId = "";
          const contacts = await dbStore.contacts.findMany();
          const existingContact = contacts.find(
            (ct: any) => ct.email === email,
          );

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            const newContact = await dbStore.contacts.insert({
              orgId,
              email,
              firstName: firstName || null,
              lastName: lastName || "Web Contact",
              custom: null,
              accountId: null,
              ownerId: "user-system",
            });
            contactId = newContact.id;

            await dbStore.auditLogs.insert({
              orgId,
              recordId: contactId,
              recordType: "Contact",
              action: "create",
              userId: tenantContext.userId || "user-system",
              changes: null,
            });
          }

          let resolvedAssignedToId = assignedToId || null;
          const rules = await dbStore.ticketAssignmentRules.findMany();
          const activeRule = rules.find((r: any) => r.isActive === 1);

          if (activeRule) {
            const allEntries =
              await dbStore.ticketAssignmentRuleEntries.findMany();
            const activeEntries = allEntries
              .filter((e: any) => e.ruleId === activeRule.id)
              .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

            if (activeEntries.length > 0) {
              const evalTicket = {
                subject,
                body,
                priority: priority || "Medium",
                custom: null,
                email,
                firstName: firstName || null,
                lastName: lastName || "Web Contact",
              };

              const matchResult = evaluateTicketAssignment(
                evalTicket,
                activeEntries,
              );
              if (matchResult) {
                resolvedAssignedToId = matchResult.newAssignedToId;
                const matchedEntry = activeEntries.find(
                  (e: any) => e.id === matchResult.matchedEntryId,
                );
                if (
                  matchedEntry &&
                  matchedEntry.routingMethod === "round_robin"
                ) {
                  await dbStore.ticketAssignmentRuleEntries.update(
                    matchedEntry.id,
                    {
                      lastAssignedIndex: matchResult.newLastAssignedIndex,
                    },
                  );
                }
              }
            }
          }

          if (!resolvedAssignedToId) {
            resolvedAssignedToId = tenantContext.userId || "user-system";
          }

          const newTicket = await dbStore.tickets.insert({
            orgId,
            contactId,
            subject,
            status: "Open",
            priority: priority || "Medium",
            assignedToId: resolvedAssignedToId,
          });

          await dbStore.auditLogs.insert({
            orgId,
            recordId: newTicket.id,
            recordType: "Ticket",
            action: "create",
            userId: tenantContext.userId || resolvedAssignedToId,
            changes: null,
          });

          if (options.onActivityTriggered) {
            await options.onActivityTriggered(orgId, "ticket.created", {
              id: newTicket.id,
              orgId,
              contactId,
              subject,
              body,
              status: "Open",
              priority: priority || "Medium",
              assignedToId: resolvedAssignedToId,
              custom: null,
            });
          }

          return {
            content: [{ type: "text", text: JSON.stringify(newTicket) }],
          };
        }
        case "crm_add_ticket_comment": {
          const { ticketId, body, authorId } = args;
          const ticket = await dbStore.tickets.findOne(ticketId);
          if (!ticket) {
            throw new Error("Ticket not found");
          }

          const res = await dbStore.ticketComments.insert({
            orgId: tenantContext.orgId,
            ticketId,
            authorId,
            body,
          });

          await dbStore.auditLogs.insert({
            orgId: tenantContext.orgId,
            recordId: ticketId,
            recordType: "Ticket",
            action: "comment_added",
            userId: tenantContext.userId || authorId,
            changes: {
              commentId: { before: null, after: res.id },
            },
          });

          return { content: [{ type: "text", text: JSON.stringify(res) }] };
        }
        case "crm_apply_ticket_macro": {
          const { ticketId, macroId } = args;
          const ticket = await dbStore.tickets.findOne(ticketId);
          const macro = await dbStore.ticketMacros.findOne(macroId);
          if (!ticket || !macro) {
            throw new Error("Ticket or Macro not found");
          }

          const result = applyTicketMacro({
            ticket: {
              id: ticket.id,
              orgId: ticket.orgId,
              status: ticket.status as any,
              priority: ticket.priority as any,
            },
            macro: {
              id: macro.id,
              orgId: macro.orgId,
              name: macro.name,
              cannedResponse: macro.cannedResponse,
              updateStatus: macro.updateStatus as any,
              updatePriority: macro.updatePriority as any,
            },
          });

          const updates: Record<string, any> = {};
          const changes: Record<string, { before: any; after: any }> = {};

          if (result.updatedStatus !== ticket.status) {
            updates.status = result.updatedStatus;
            changes.status = {
              before: ticket.status,
              after: result.updatedStatus,
            };
          }
          if (result.updatedPriority !== ticket.priority) {
            updates.priority = result.updatedPriority;
            changes.priority = {
              before: ticket.priority,
              after: result.updatedPriority,
            };
          }

          if (Object.keys(updates).length > 0) {
            await dbStore.tickets.update(ticketId, updates);
          }

          const comment = await dbStore.ticketComments.insert({
            orgId: tenantContext.orgId,
            ticketId,
            authorId: tenantContext.userId || "user-system",
            body: result.commentBody,
          });

          await dbStore.auditLogs.insert({
            orgId: tenantContext.orgId,
            recordId: ticketId,
            recordType: "Ticket",
            action: "macro_applied",
            userId: tenantContext.userId || "user-system",
            changes: {
              macroId: { before: null, after: macroId },
              commentId: { before: null, after: comment.id },
              ...changes,
            },
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  comment,
                  ticket: { ...ticket, ...updates },
                }),
              },
            ],
          };
        }

        default: {
          const customTypes = await dbStore.customEntityTypes.findMany();
          for (const customType of customTypes) {
            const objName = customType.name.toLowerCase();
            if (name === `crm_get_${objName}`) {
              const record = await dbStore.customEntityRecords.findOne(args.id);
              if (!record || record.typeId !== customType.id) {
                return {
                  content: [{ type: "text", text: "Record not found" }],
                  isError: true,
                };
              }
              return {
                content: [{ type: "text", text: JSON.stringify(record) }],
              };
            }
            if (name === `crm_list_${objName}`) {
              const allRecords = await dbStore.customEntityRecords.findMany();
              const records = allRecords.filter(
                (r: any) => r.typeId === customType.id,
              );
              return {
                content: [{ type: "text", text: JSON.stringify(records) }],
              };
            }
            if (name === `crm_create_${objName}`) {
              const { defineObject } = await import("@crm/metadata");
              const definition = defineObject({
                name: customType.name,
                fields: customType.fieldsJson,
              });
              const validation = definition.validateRecord(args);
              if (!validation.success) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `Validation failed: ${validation.errors?.join(", ")}`,
                    },
                  ],
                  isError: true,
                };
              }
              const record = await dbStore.customEntityRecords.insert({
                orgId: tenantContext.orgId,
                typeId: customType.id,
                data: validation.data as Record<string, unknown>,
              });
              return {
                content: [{ type: "text", text: JSON.stringify(record) }],
              };
            }
            if (name === `crm_update_${objName}`) {
              const record = await dbStore.customEntityRecords.findOne(args.id);
              if (!record || record.typeId !== customType.id) {
                return {
                  content: [{ type: "text", text: "Record not found" }],
                  isError: true,
                };
              }
              const { defineObject } = await import("@crm/metadata");
              const definition = defineObject({
                name: customType.name,
                fields: customType.fieldsJson,
              });
              const { id, ...updates } = args;
              const mergedData = { ...(record.data || {}), ...updates };
              const validation = definition.validateRecord(mergedData);
              if (!validation.success) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `Validation failed: ${validation.errors?.join(", ")}`,
                    },
                  ],
                  isError: true,
                };
              }
              const updated = await dbStore.customEntityRecords.update(
                args.id,
                {
                  data: validation.data as Record<string, unknown>,
                },
              );
              return {
                content: [{ type: "text", text: JSON.stringify(updated) }],
              };
            }
            if (name === `crm_delete_${objName}`) {
              const record = await dbStore.customEntityRecords.findOne(args.id);
              if (!record || record.typeId !== customType.id) {
                return {
                  content: [{ type: "text", text: "Record not found" }],
                  isError: true,
                };
              }
              const success = await dbStore.customEntityRecords.delete(args.id);
              return {
                content: [{ type: "text", text: JSON.stringify({ success }) }],
              };
            }
          }
          throw new Error(`Unknown tool call: ${name}`);
        }
      }
    });
  });

  // 3. Resources List & Read handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "crm://leads",
          name: "All Leads",
          mimeType: "application/json",
        },
        {
          uri: "crm://opportunities",
          name: "All Opportunities",
          mimeType: "application/json",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    return await wrap(async () => {
      if (uri === "crm://leads") {
        const res = await dbStore.leads.findMany();
        return {
          contents: [
            { uri, mimeType: "application/json", text: JSON.stringify(res) },
          ],
        };
      }
      if (uri.startsWith("crm://leads/")) {
        const leadId = uri.substring("crm://leads/".length);
        const res = await dbStore.leads.findOne(leadId);
        return {
          contents: [
            { uri, mimeType: "application/json", text: JSON.stringify(res) },
          ],
        };
      }
      if (uri === "crm://opportunities") {
        const res = await dbStore.opportunities.findMany();
        return {
          contents: [
            { uri, mimeType: "application/json", text: JSON.stringify(res) },
          ],
        };
      }
      if (uri.startsWith("crm://opportunities/")) {
        const oppId = uri.substring("crm://opportunities/".length);
        const res = await dbStore.opportunities.findOne(oppId);
        return {
          contents: [
            { uri, mimeType: "application/json", text: JSON.stringify(res) },
          ],
        };
      }
      throw new Error(`Resource not found: ${uri}`);
    });
  });

  // 4. Prompts List & Get handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "crm_summarize_lead_pipeline",
          description: "Generate a pipeline analysis of current active leads.",
        },
        {
          name: "crm_draft_outreach_email",
          description:
            "Draft a personalized outreach email for a lead or contact.",
        },
        {
          name: "crm_qualify_opportunity",
          description:
            "Analyze dynamic custom criteria to qualify a pending opportunity.",
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === "crm_summarize_lead_pipeline") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Please query the active lead records, evaluate their custom field rules, and generate a summary highlighting hot targets vs stale leads.",
            },
          },
        ],
      };
    }
    if (name === "crm_draft_outreach_email") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Draft an engaging, personalized cold outreach email using active contact detail attributes.",
            },
          },
        ],
      };
    }
    if (name === "crm_qualify_opportunity") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Review opportunities close dates, custom pickup definitions, and amounts to recommend next stage progression targets.",
            },
          },
        ],
      };
    }

    throw new Error(`Prompt not found: ${name}`);
  });

  return server;
}

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  JSONRPCMessage,
  JSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";

export class InMemoryTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  sent: JSONRPCMessage[] = [];
  private pendingResolvers = new Map<
    string | number,
    (response: JSONRPCResponse) => void
  >();

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    this.sent.push(message);
    if ("result" in message || "error" in message) {
      const id = message.id;
      if (id !== undefined && id !== null) {
        const resolver = this.pendingResolvers.get(id);
        if (resolver) {
          resolver(message as JSONRPCResponse);
          this.pendingResolvers.delete(id);
        }
      }
    }
  }

  async close(): Promise<void> {
    if (this.onclose) this.onclose();
  }

  async sendRequest(request: {
    method: string;
    params?: any;
    id: number;
  }): Promise<JSONRPCResponse> {
    const jsonrpcRequest = {
      jsonrpc: "2.0" as const,
      ...request,
    };

    const promise = new Promise<JSONRPCResponse>((resolve) => {
      this.pendingResolvers.set(request.id, resolve);
    });

    if (this.onmessage) {
      this.onmessage(jsonrpcRequest);
    } else {
      throw new Error("Transport not connected to a server");
    }

    return promise;
  }
}
