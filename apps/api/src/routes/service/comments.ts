import { validateTicketCommentInput } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const commentsRouter = new Hono<Env>();

commentsRouter.post("/tickets/:id/comments", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const tenant = c.get("tenant");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const body = await c.req.json();
  const validation = validateTicketCommentInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const comment = await dbStore.ticketComments.insert({
    orgId: tenant.orgId,
    ticketId,
    authorId: tenant.userId,
    body: body.body,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: comment.id,
    recordType: "ticket_comments",
    action: "create",
    userId: tenant.userId,
    changes: {
      body: { before: null, after: body.body },
    },
  });

  return c.json({ success: true, data: comment });
});

commentsRouter.get("/tickets/:id/comments", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const allComments = await dbStore.ticketComments.findMany();
  const filtered = allComments
    .filter((c) => c.ticketId === ticketId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return c.json({ success: true, data: filtered });
});
