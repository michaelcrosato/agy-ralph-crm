import { calculateSlaStatus } from "@crm/core";
import { dbStore } from "@crm/db";
import { OpenAPIHono } from "@hono/zod-openapi";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const slaRouter = new OpenAPIHono<Env>();

slaRouter.use(tenantAuth);

slaRouter.post("/sla-targets", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { maxResponseTimeMinutes } = body;

  const targetMinutes =
    maxResponseTimeMinutes !== undefined ? Number(maxResponseTimeMinutes) : 60;

  const existingTargets = await dbStore.leadSlaTargets.findMany();
  for (const t of existingTargets) {
    if (t.isActive === 1) {
      await dbStore.leadSlaTargets.update(t.id, { isActive: 0 });
    }
  }

  const target = await dbStore.leadSlaTargets.insert({
    orgId: tenant.orgId,
    maxResponseTimeMinutes: targetMinutes,
    isActive: 1,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: target.id,
    recordType: "lead_sla_targets",
    action: "create",
    userId: tenant.userId,
    changes: { target: { before: null, after: target } },
  });

  return c.json({ success: true, data: target }, 201);
});

slaRouter.get("/sla-targets", tenantAuth, async (c) => {
  const targets = await dbStore.leadSlaTargets.findMany();
  const activeTarget = targets.find((t) => t.isActive === 1);
  return c.json({ success: true, data: activeTarget || null });
});

slaRouter.get("/sla-breaches", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const trackers = await dbStore.leadSlaTrackers.findMany();
  const pendingTrackers = trackers.filter((t) => t.status === "Pending");

  const targets = await dbStore.leadSlaTargets.findMany();
  const activeTarget = targets.find((t) => t.isActive === 1);
  const maxMinutes = activeTarget ? activeTarget.maxResponseTimeMinutes : 60;

  const now = new Date();
  for (const tracker of pendingTrackers) {
    const slaStatus = calculateSlaStatus(
      tracker.createdAt,
      maxMinutes,
      null,
      now,
    );
    if (slaStatus.status === "Breached") {
      await dbStore.leadSlaTrackers.update(tracker.id, {
        status: "Breached",
        responseTimeMinutes: slaStatus.responseTimeMinutes,
      });

      await dbStore.auditLogs.insert({
        orgId: tenant.orgId,
        recordId: tracker.leadId,
        recordType: "leads",
        action: "sla_breach",
        userId: tenant.userId,
        changes: { status: { before: "Pending", after: "Breached" } },
      });

      await triggerOutboundWebhooks(tenant.orgId, "lead.sla_breached", {
        leadId: tracker.leadId,
        trackerId: tracker.id,
        responseTimeMinutes: slaStatus.responseTimeMinutes,
      });
    }
  }

  const reloaded = await dbStore.leadSlaTrackers.findMany();
  const breached = reloaded.filter((t) => t.status === "Breached");

  return c.json({ success: true, data: breached });
});

slaRouter.post("/:id/respond", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const trackers = await dbStore.leadSlaTrackers.findForLead(id);
  const tracker = trackers.find((t) => t.respondedAt === null);

  if (!tracker) {
    return c.json({ error: "No active SLA tracker found for this lead" }, 404);
  }

  const targets = await dbStore.leadSlaTargets.findMany();
  const activeTarget = targets.find((t) => t.isActive === 1);
  const maxMinutes = activeTarget ? activeTarget.maxResponseTimeMinutes : 60;

  const now = new Date();
  const slaStatus = calculateSlaStatus(tracker.createdAt, maxMinutes, now, now);

  const updatedTracker = await dbStore.leadSlaTrackers.update(tracker.id, {
    status: slaStatus.status,
    respondedAt: now,
    responseTimeMinutes: slaStatus.responseTimeMinutes,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "leads",
    action: "respond",
    userId: tenant.userId,
    changes: {
      slaTracker: { before: tracker, after: updatedTracker },
    },
  });

  if (slaStatus.status === "Met") {
    await triggerOutboundWebhooks(tenant.orgId, "lead.sla_resolved", {
      leadId: id,
      trackerId: tracker.id,
      status: "Met",
      responseTimeMinutes: slaStatus.responseTimeMinutes,
    });
  } else if (slaStatus.status === "Breached") {
    await triggerOutboundWebhooks(tenant.orgId, "lead.sla_breached", {
      leadId: id,
      trackerId: tracker.id,
      status: "Breached",
      responseTimeMinutes: slaStatus.responseTimeMinutes,
    });
  }

  return c.json({ success: true, data: updatedTracker });
});
