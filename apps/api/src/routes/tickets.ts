import { dbStore } from "@crm/db";
import { createTicket, resolveTicket } from "@crm/module-service-lite";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Basic support ticket CRUD. /api/service/tickets/* sits in routes/service.ts. */
export const ticketsApp = new Hono<Env>();

ticketsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { contactId, subject } = body;

  if (!contactId || !subject) {
    return c.json({ error: "Missing required ticketing parameters" }, 400);
  }

  const ticketData = createTicket({
    orgId: tenant.orgId,
    contactId,
    subject,
  });

  const newTicket = await dbStore.tickets.insert({
    orgId: tenant.orgId,
    contactId: ticketData.contactId,
    subject: ticketData.subject,
    status: ticketData.status,
  });

  return c.json({ success: true, data: newTicket });
});

ticketsApp.get("/", tenantAuth, async (c) => {
  const tickets = await dbStore.tickets.findMany();
  return c.json({ success: true, data: tickets });
});

ticketsApp.post("/:id/resolve", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(id);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const resolved = resolveTicket(ticket);
  const updated = await dbStore.tickets.update(id, {
    status: resolved.status,
  });

  if (updated) {
    await triggerOutboundWebhooks(
      updated.orgId,
      "ticket.resolved",
      updated as unknown as Record<string, unknown>,
    );
  }

  return c.json({ success: true, data: updated });
});
