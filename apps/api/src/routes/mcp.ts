import { applyTicketMacro, evaluateTicketAssignment } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { mcpTools } from "../lib/mcpTools";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Model Context Protocol surface. List tools + execute calls. */
export const mcpApp = new Hono<Env>();

mcpApp.get("/tools", (c) => c.json({ tools: mcpTools }));

mcpApp.post("/tools/call", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, arguments: args } = body;

  if (!name) {
    return c.json({ error: "Missing tool name parameter" }, 400);
  }

  if (name === "crm_get_account") {
    const accountId = args?.accountId;
    if (!accountId) {
      return c.json({ error: "Missing required argument: accountId" }, 400);
    }
    const account = await dbStore.accounts.findOne(accountId);
    return c.json({
      content: [{ type: "text", text: JSON.stringify(account) }],
    });
  }

  if (name === "crm_list_contacts") {
    const contacts = await dbStore.contacts.findMany();
    return c.json({
      content: [{ type: "text", text: JSON.stringify(contacts) }],
    });
  }

  if (name === "crm_get_ticket") {
    const ticketId = args?.ticketId;
    if (!ticketId) {
      return c.json({ error: "Missing required argument: ticketId" }, 400);
    }
    const ticket = await dbStore.tickets.findOne(ticketId);
    return c.json({
      content: [{ type: "text", text: JSON.stringify(ticket) }],
    });
  }

  if (name === "crm_list_tickets") {
    const statusFilter = args?.status;
    const allTickets = await dbStore.tickets.findMany();
    const filteredTickets = statusFilter
      ? allTickets.filter((t) => t.status === statusFilter)
      : allTickets;
    return c.json({
      content: [{ type: "text", text: JSON.stringify(filteredTickets) }],
    });
  }

  if (name === "crm_create_ticket") {
    const {
      subject,
      body: ticketBody,
      email,
      firstName,
      lastName,
      priority,
      assignedToId,
    } = args || {};
    if (!subject || !ticketBody || !email) {
      return c.json(
        { error: "Missing required arguments: subject, body, email" },
        400,
      );
    }

    const orgId = tenant.orgId;

    let contactId = "";
    const contacts = await dbStore.contacts.findMany();
    const existingContact = contacts.find((ct) => ct.email === email);

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
        userId: tenant.userId || "user-system",
        changes: null,
      });
    }

    let resolvedAssignedToId = assignedToId || null;
    const rules = await dbStore.ticketAssignmentRules.findMany();
    const activeRule = rules.find((r) => r.isActive === 1);

    if (activeRule) {
      const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
      const activeEntries = allEntries
        .filter((e) => e.ruleId === activeRule.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (activeEntries.length > 0) {
        const evalTicket = {
          subject,
          body: ticketBody,
          priority: priority || "Medium",
          custom: null,
          email,
          firstName: firstName || null,
          lastName: lastName || "Web Contact",
        };

        const matchResult = evaluateTicketAssignment(evalTicket, activeEntries);
        if (matchResult) {
          resolvedAssignedToId = matchResult.newAssignedToId;

          const matchedEntry = activeEntries.find(
            (e) => e.id === matchResult.matchedEntryId,
          );
          if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
            await dbStore.ticketAssignmentRuleEntries.update(matchedEntry.id, {
              lastAssignedIndex: matchResult.newLastAssignedIndex,
            });
          }
        }
      }
    }

    if (!resolvedAssignedToId) {
      resolvedAssignedToId = tenant.userId || "user-system";
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
      userId: tenant.userId || resolvedAssignedToId,
      changes: null,
    });

    await triggerOutboundWebhooks(orgId, "ticket.created", {
      id: newTicket.id,
      orgId,
      contactId,
      subject,
      body: ticketBody,
      status: "Open",
      priority: priority || "Medium",
      assignedToId: resolvedAssignedToId,
      custom: null,
    });

    return c.json({
      content: [{ type: "text", text: JSON.stringify(newTicket) }],
    });
  }

  if (name === "crm_add_ticket_comment") {
    const { ticketId, body: commentBody, authorId } = args || {};
    if (!ticketId || !commentBody || !authorId) {
      return c.json(
        { error: "Missing required arguments: ticketId, body, authorId" },
        400,
      );
    }

    const ticket = await dbStore.tickets.findOne(ticketId);
    if (!ticket) {
      return c.json({ error: "Ticket not found" }, 404);
    }

    const newComment = await dbStore.ticketComments.insert({
      orgId: tenant.orgId,
      ticketId,
      authorId,
      body: commentBody,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: ticketId,
      recordType: "Ticket",
      action: "comment_added",
      userId: tenant.userId || authorId,
      changes: {
        commentId: { before: null, after: newComment.id },
      },
    });

    return c.json({
      content: [{ type: "text", text: JSON.stringify(newComment) }],
    });
  }

  if (name === "crm_apply_ticket_macro") {
    const { ticketId, macroId } = args || {};
    if (!ticketId || !macroId) {
      return c.json(
        { error: "Missing required arguments: ticketId, macroId" },
        400,
      );
    }

    const ticket = await dbStore.tickets.findOne(ticketId);
    if (!ticket) {
      return c.json({ error: "Ticket not found" }, 404);
    }

    const macro = await dbStore.ticketMacros.findOne(macroId);
    if (!macro) {
      return c.json({ error: "Macro not found" }, 404);
    }

    const result = applyTicketMacro({
      ticket: {
        id: ticket.id,
        orgId: ticket.orgId,
        status: ticket.status as "Open" | "In Progress" | "Resolved",
        priority: ticket.priority as "Low" | "Medium" | "High" | "Urgent",
      },
      macro: {
        id: macro.id,
        orgId: macro.orgId,
        name: macro.name,
        cannedResponse: macro.cannedResponse,
        updateStatus: macro.updateStatus as
          | "Open"
          | "In Progress"
          | "Resolved"
          | null,
        updatePriority: macro.updatePriority as
          | "Low"
          | "Medium"
          | "High"
          | "Urgent"
          | null,
      },
    });

    const updates: Record<string, unknown> = {};
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    if (result.updatedStatus !== ticket.status) {
      updates.status = result.updatedStatus;
      changes.status = { before: ticket.status, after: result.updatedStatus };
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

    const newComment = await dbStore.ticketComments.insert({
      orgId: tenant.orgId,
      ticketId,
      authorId: tenant.userId || "user-system",
      body: result.commentBody,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: ticketId,
      recordType: "Ticket",
      action: "macro_applied",
      userId: tenant.userId || "user-system",
      changes: {
        macroId: { before: null, after: macroId },
        commentId: { before: null, after: newComment.id },
        ...changes,
      },
    });

    return c.json({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            comment: newComment,
            ticket: { ...ticket, ...updates },
          }),
        },
      ],
    });
  }

  return c.json({ error: "Unknown MCP tool called" }, 400);
});
