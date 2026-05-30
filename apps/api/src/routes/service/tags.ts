import { validateTicketTagInput } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const tagsRouter = new Hono<Env>();

tagsRouter.post("/tags", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  const validation = validateTicketTagInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const existingTags = await dbStore.ticketTags.findMany();
  if (
    existingTags.some(
      (t) => t.name.toLowerCase() === body.name.trim().toLowerCase(),
    )
  ) {
    return c.json({ error: "Tag name already exists" }, 400);
  }

  const tag = await dbStore.ticketTags.insert({
    orgId: tenant.orgId,
    name: body.name.trim(),
    color: body.color,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: tag.id,
    recordType: "ticket_tags",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: tag.name },
      color: { before: null, after: tag.color },
    },
  });

  return c.json({ success: true, data: tag });
});

tagsRouter.get("/tags", tenantAuth, async (c) => {
  const tags = await dbStore.ticketTags.findMany();
  return c.json({ success: true, data: tags });
});

tagsRouter.post("/tickets/:id/tags", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const tenant = c.get("tenant");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const body = await c.req.json();
  const { tagId } = body;
  if (!tagId) {
    return c.json({ error: "tagId is required" }, 400);
  }

  const tag = await dbStore.ticketTags.findOne(tagId);
  if (!tag) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const existingLinks = await dbStore.ticketTagLinks.findMany();
  const alreadyLinked = existingLinks.find(
    (l) => l.ticketId === ticketId && l.tagId === tagId,
  );

  if (alreadyLinked) {
    return c.json({ success: true, data: alreadyLinked });
  }

  const link = await dbStore.ticketTagLinks.insert({
    orgId: tenant.orgId,
    ticketId,
    tagId,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: link.id,
    recordType: "ticket_tag_links",
    action: "create",
    userId: tenant.userId,
    changes: {
      ticketId: { before: null, after: ticketId },
      tagId: { before: null, after: tagId },
    },
  });

  return c.json({ success: true, data: link });
});

tagsRouter.delete("/tickets/:id/tags/:tagId", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const tagId = c.req.param("tagId");
  const tenant = c.get("tenant");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const existingLinks = await dbStore.ticketTagLinks.findMany();
  const link = existingLinks.find(
    (l) => l.ticketId === ticketId && l.tagId === tagId,
  );

  if (!link) {
    return c.json({ error: "Tag link not found" }, 404);
  }

  await dbStore.ticketTagLinks.delete(link.id);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: link.id,
    recordType: "ticket_tag_links",
    action: "delete",
    userId: tenant.userId,
    changes: {
      ticketId: { before: ticketId, after: null },
      tagId: { before: tagId, after: null },
    },
  });

  return c.json({ success: true });
});

tagsRouter.get("/tickets/:id/tags", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const allLinks = await dbStore.ticketTagLinks.findMany();
  const ticketLinks = allLinks.filter((l) => l.ticketId === ticketId);

  const allTags = await dbStore.ticketTags.findMany();
  const tags = ticketLinks
    .map((link) => allTags.find((t) => t.id === link.tagId))
    .filter(Boolean);

  return c.json({ success: true, data: tags });
});
