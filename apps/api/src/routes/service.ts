import { evaluateTicketAssignment } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/**
 * Service tickets sub-resource: routing rules CRUD + manual + auto-routed
 * assignment. Mounted at /api/service.
 */
export const serviceApp = new Hono<Env>();

serviceApp.post("/tickets/routing-rules", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, isActive } = body;

  if (!name) {
    return c.json({ error: "Missing required routing rule name" }, 400);
  }

  const activeVal = isActive !== undefined ? Number(isActive) : 0;

  if (activeVal === 1) {
    const allRules = await dbStore.ticketAssignmentRules.findMany();
    for (const r of allRules) {
      if (r.isActive === 1) {
        await dbStore.ticketAssignmentRules.update(r.id, { isActive: 0 });
      }
    }
  }

  const newRule = await dbStore.ticketAssignmentRules.insert({
    orgId: tenant.orgId,
    name,
    isActive: activeVal,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newRule.id,
    recordType: "ticket_assignment_rules",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: newRule }, 201);
});

serviceApp.get("/tickets/routing-rules", tenantAuth, async (c) => {
  const rules = await dbStore.ticketAssignmentRules.findMany();
  return c.json({ success: true, data: rules });
});

serviceApp.post(
  "/tickets/routing-rules/:id/entries",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const ruleId = c.req.param("id");
    const rule = await dbStore.ticketAssignmentRules.findOne(ruleId);
    if (!rule) {
      return c.json({ error: "Routing rule not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const { sortOrder, routingMethod, routingUserIds, criteria } = body;

    if (
      sortOrder === undefined ||
      !routingMethod ||
      !routingUserIds ||
      !criteria
    ) {
      return c.json({ error: "Missing required rule entry parameters" }, 400);
    }

    const entry = await dbStore.ticketAssignmentRuleEntries.insert({
      orgId: tenant.orgId,
      ruleId,
      sortOrder: Number(sortOrder),
      routingMethod,
      routingUserIds,
      lastAssignedIndex: -1,
      criteria,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: entry.id,
      recordType: "ticket_assignment_rule_entries",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });

    return c.json({ success: true, data: entry }, 201);
  },
);

serviceApp.get(
  "/tickets/routing-rules/:id/entries",
  tenantAuth,
  async (c) => {
    const ruleId = c.req.param("id");
    const rule = await dbStore.ticketAssignmentRules.findOne(ruleId);
    if (!rule) {
      return c.json({ error: "Routing rule not found" }, 404);
    }

    const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
    const ruleEntries = allEntries
      .filter((e) => e.ruleId === ruleId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return c.json({ success: true, data: ruleEntries });
  },
);

serviceApp.post("/tickets/:id/route", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(id);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const rules = await dbStore.ticketAssignmentRules.findMany();
  const activeRule = rules.find((r) => r.isActive === 1);
  if (!activeRule) {
    return c.json({ error: "No active ticket assignment rule found" }, 400);
  }

  const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
  const activeEntries = allEntries
    .filter((e) => e.ruleId === activeRule.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const match = evaluateTicketAssignment(
    ticket as unknown as Record<string, unknown>,
    activeEntries,
  );

  if (!match) {
    return c.json(
      { error: "No matching routing entry found for this ticket" },
      400,
    );
  }

  const oldAssignedToId = ticket.assignedToId || null;
  const updatedTicket = await dbStore.tickets.update(id, {
    assignedToId: match.newAssignedToId,
  });

  const matchedEntry = activeEntries.find((e) => e.id === match.matchedEntryId);
  if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
    await dbStore.ticketAssignmentRuleEntries.update(matchedEntry.id, {
      lastAssignedIndex: match.newLastAssignedIndex,
    });
  }

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Ticket",
    action: "assign",
    userId: tenant.userId,
    changes: {
      assignedToId: { before: oldAssignedToId, after: match.newAssignedToId },
    },
  });

  triggerOutboundWebhooks(tenant.orgId, "ticket.routed", {
    ticketId: id,
    assignedToId: match.newAssignedToId,
  });

  return c.json({ success: true, data: updatedTicket });
});

serviceApp.put("/tickets/:id/assign", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(id);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { assignedToId } = body;

  const oldAssignedToId = ticket.assignedToId || null;
  const updated = await dbStore.tickets.update(id, {
    assignedToId: assignedToId || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Ticket",
    action: "assign",
    userId: tenant.userId,
    changes: {
      assignedToId: { before: oldAssignedToId, after: assignedToId || null },
    },
  });

  triggerOutboundWebhooks(tenant.orgId, "ticket.assigned", {
    ticketId: id,
    assignedToId: assignedToId || null,
  });

  return c.json({ success: true, data: updated });
});
