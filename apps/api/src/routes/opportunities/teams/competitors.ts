import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../../lib/webhooks";
import { type Env, tenantAuth } from "../../../middleware/tenantAuth";

export const competitorsApp = new Hono<Env>();

competitorsApp.get("/:id/competitors", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  if (opportunity.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const allCompetitors = await dbStore.opportunityCompetitors.findMany();
  const competitors = allCompetitors.filter(
    (comp) => comp.opportunityId === id,
  );

  return c.json({ success: true, data: competitors });
});

competitorsApp.post("/:id/competitors", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  if (opportunity.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Competitor name is required." }, 400);
  }

  const winLossStatus = body.winLossStatus || "Pending";
  if (!["Pending", "Won", "Lost"].includes(winLossStatus)) {
    return c.json({ error: "Invalid winLossStatus." }, 400);
  }

  const newCompetitor = await dbStore.opportunityCompetitors.insert({
    orgId: tenant.orgId,
    opportunityId: id,
    name: body.name.trim(),
    strength: body.strength || null,
    weakness: body.weakness || null,
    winLossStatus,
    notes: body.notes || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newCompetitor.id,
    recordType: "opportunity_competitors",
    action: "create",
    userId: tenant.userId,
    changes: { competitor: { before: null, after: newCompetitor } },
  });

  await triggerOutboundWebhooks(tenant.orgId, "competitor.created", {
    competitor: newCompetitor,
  });

  return c.json({ success: true, data: newCompetitor }, 201);
});

competitorsApp.put("/:id/competitors/:competitorId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const competitorId = c.req.param("competitorId");
  const body = await c.req.json().catch(() => ({}));

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  if (opportunity.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const competitor = await dbStore.opportunityCompetitors.findOne(competitorId);
  if (!competitor || competitor.opportunityId !== id) {
    return c.json({ error: "Competitor not found on this opportunity" }, 404);
  }

  if (
    body.winLossStatus &&
    !["Pending", "Won", "Lost"].includes(body.winLossStatus)
  ) {
    return c.json({ error: "Invalid winLossStatus." }, 400);
  }

  const updates: Partial<
    Omit<
      Parameters<typeof dbStore.opportunityCompetitors.update>[1],
      "id" | "orgId" | "createdAt"
    >
  > = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.strength !== undefined) updates.strength = body.strength;
  if (body.weakness !== undefined) updates.weakness = body.weakness;
  if (body.winLossStatus !== undefined)
    updates.winLossStatus = body.winLossStatus;
  if (body.notes !== undefined) updates.notes = body.notes;

  const updatedCompetitor = await dbStore.opportunityCompetitors.update(
    competitorId,
    updates,
  );

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: competitorId,
    recordType: "opportunity_competitors",
    action: "update",
    userId: tenant.userId,
    changes: { competitor: { before: competitor, after: updatedCompetitor } },
  });

  await triggerOutboundWebhooks(tenant.orgId, "competitor.updated", {
    competitor: updatedCompetitor,
  });

  return c.json({ success: true, data: updatedCompetitor });
});

competitorsApp.delete(
  "/:id/competitors/:competitorId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const competitorId = c.req.param("competitorId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    if (opportunity.orgId !== tenant.orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }

    const competitor =
      await dbStore.opportunityCompetitors.findOne(competitorId);
    if (!competitor || competitor.opportunityId !== id) {
      return c.json({ error: "Competitor not found on this opportunity" }, 404);
    }

    const deleted = await dbStore.opportunityCompetitors.delete(competitorId);

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: competitorId,
      recordType: "opportunity_competitors",
      action: "delete",
      userId: tenant.userId,
      changes: { competitor: { before: competitor, after: null } },
    });

    await triggerOutboundWebhooks(tenant.orgId, "competitor.deleted", {
      competitorId,
    });

    return c.json({ success: deleted });
  },
);
