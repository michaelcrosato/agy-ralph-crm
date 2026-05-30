import { applyTicketMacro, evaluateTicketAssignment } from "@crm/core";
import type { McpServerOptions, TenantContext } from "../index";

export const serviceSchemas = [
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

export async function handleServiceTool(
  name: string,
  args: any,
  dbStore: any,
  tenantContext: TenantContext,
  options: McpServerOptions,
): Promise<any> {
  switch (name) {
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
      const existingContact = contacts.find((ct: any) => ct.email === email);

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
        const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
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
            if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
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
    default:
      return undefined;
  }
}
