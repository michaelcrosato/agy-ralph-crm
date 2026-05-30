import { applyTicketMacro, validateTicketMacroInput } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const macrosRouter = new Hono<Env>();

macrosRouter.post("/tickets/macros", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();

  const validation = validateTicketMacroInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const newMacro = await dbStore.ticketMacros.insert({
    orgId: tenant.orgId,
    name: body.name,
    description: body.description || null,
    cannedResponse: body.cannedResponse,
    updateStatus: body.updateStatus || null,
    updatePriority: body.updatePriority || null,
  });

  return c.json({ success: true, data: newMacro });
});

macrosRouter.get("/tickets/macros", tenantAuth, async (c) => {
  const macros = await dbStore.ticketMacros.findMany();
  return c.json({ success: true, data: macros });
});

macrosRouter.post(
  "/tickets/:id/apply-macro/:macroId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const ticketId = c.req.param("id");
    const macroId = c.req.param("macroId");

    const ticket = await dbStore.tickets.findOne(ticketId);
    if (!ticket) {
      return c.json({ error: "Ticket not found" }, 404);
    }

    const macro = await dbStore.ticketMacros.findOne(macroId);
    if (!macro) {
      return c.json({ error: "Macro not found" }, 404);
    }

    if (ticket.orgId !== tenant.orgId || macro.orgId !== tenant.orgId) {
      return c.json(
        { error: "RLS Isolation Violation: Tenant mismatch." },
        403,
      );
    }

    const result = applyTicketMacro({
      ticket: {
        id: ticket.id,
        orgId: ticket.orgId,
        status: ticket.status,
        priority: ticket.priority || "Medium",
      },
      macro: {
        id: macro.id,
        orgId: macro.orgId,
        name: macro.name,
        cannedResponse: macro.cannedResponse,
        updateStatus: macro.updateStatus,
        updatePriority: macro.updatePriority,
      },
    });

    const updatedTicket = await dbStore.tickets.update(ticketId, {
      status: result.updatedStatus as "Open" | "In Progress" | "Resolved",
      priority: result.updatedPriority as "Low" | "Medium" | "High" | "Urgent",
    });

    const newComment = await dbStore.ticketComments.insert({
      orgId: tenant.orgId,
      ticketId: ticketId,
      authorId: tenant.userId,
      body: result.commentBody,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: ticketId,
      recordType: "Ticket",
      action: "apply_macro",
      userId: tenant.userId,
      changes: {
        status: { before: ticket.status, after: result.updatedStatus },
        priority: {
          before: ticket.priority || "Medium",
          after: result.updatedPriority,
        },
        commentInserted: { before: null, after: newComment.id },
      },
    });

    return c.json({
      success: true,
      data: updatedTicket,
      comment: newComment,
      message: result.auditMessage,
    });
  },
);
