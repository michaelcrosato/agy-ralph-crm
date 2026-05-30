import { calculateOpportunityCommission } from "@crm/core";
import { dbStore } from "@crm/db";
import { createLogger } from "@crm/observability";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

const log = createLogger({ name: "sales-ops" });

export const territoriesApp = new Hono<Env>();
export const commissionsApp = new Hono<Env>();
export const quotasApp = new Hono<Env>();

territoriesApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, isActive, routingMethod, criteria } = body;

  if (!name || !criteria) {
    return c.json({ error: "Missing required territory parameters" }, 400);
  }

  const t = await dbStore.territories.insert({
    orgId: tenant.orgId,
    name,
    isActive: isActive !== undefined ? Number(isActive) : 0,
    routingMethod: routingMethod || "direct",
    lastAssignedIndex: -1,
    criteria,
  });

  return c.json({ success: true, data: t });
});

territoriesApp.put("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const existing = await dbStore.territories.findOne(id);
  if (!existing) {
    return c.json({ error: "Territory not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { name, isActive, routingMethod, criteria } = body;

  const updates: Parameters<typeof dbStore.territories.update>[1] = {};
  if (name !== undefined) updates.name = name;
  if (isActive !== undefined) updates.isActive = Number(isActive);
  if (routingMethod !== undefined) updates.routingMethod = routingMethod;
  if (criteria !== undefined) {
    updates.criteria = criteria as unknown as typeof updates.criteria;
  }

  const updated = await dbStore.territories.update(id, updates);
  return c.json({ success: true, data: updated });
});

territoriesApp.get("/", tenantAuth, async (c) => {
  const data = await dbStore.territories.findMany();
  return c.json({ success: true, data });
});

territoriesApp.post("/:id/members", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { userId, role } = body;

  if (!userId) {
    return c.json({ error: "Missing userId" }, 400);
  }

  const territory = await dbStore.territories.findOne(id);
  if (!territory) {
    return c.json({ error: "Territory not found" }, 404);
  }

  const member = await dbStore.territoryMembers.insert({
    orgId: tenant.orgId,
    territoryId: id,
    userId,
    role: role || "Primary",
  });

  return c.json({ success: true, data: member });
});

territoriesApp.delete("/:id/members/:userId", tenantAuth, async (c) => {
  const territoryId = c.req.param("id");
  const userId = c.req.param("userId");

  const members = await dbStore.territoryMembers.findMany();
  const matched = members.find(
    (m) => m.territoryId === territoryId && m.userId === userId,
  );

  if (!matched) {
    return c.json({ error: "Territory member not found" }, 404);
  }

  const deleted = await dbStore.territoryMembers.delete(matched.id);
  return c.json({ success: true, deleted });
});
commissionsApp.post("/calculate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { opportunityId, baseRate } = body;

  if (!opportunityId) {
    return c.json({ error: "Missing required parameter: opportunityId" }, 400);
  }

  // 1. Fetch opportunity
  const opportunity = await dbStore.opportunities.findOne(opportunityId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  // 2. Ensure Closed Won
  if (opportunity.stage !== "Closed Won") {
    return c.json(
      {
        error:
          "Commission can only be calculated for Closed Won opportunities.",
      },
      400,
    );
  }

  // 3. Ensure not already calculated
  const allCommissions = await dbStore.commissions.findMany();
  const existing = allCommissions.find(
    (comm) => comm.opportunityId === opportunityId,
  );
  if (existing) {
    return c.json(
      { error: "Commission already calculated for this opportunity." },
      400,
    );
  }

  // 4. Determine Close Date Period "YYYY-MM"
  let period = new Date().toISOString().substring(0, 7);
  if (opportunity.closeDate) {
    try {
      const d = new Date(opportunity.closeDate);
      if (!Number.isNaN(d.getTime())) {
        period = d.toISOString().substring(0, 7);
      }
    } catch (err) {
      log.warn(
        { err, closeDate: opportunity.closeDate },
        "Invalid closeDate format, using current month as period",
      );
    }
  }

  // Check if opportunity has splits!
  const splits =
    await dbStore.opportunitySplits.findForOpportunity(opportunityId);

  if (splits.length > 0) {
    const insertedCommissions = [];
    const allQuotas = await dbStore.quotas.findMany();

    for (const split of splits) {
      // Fetch quota for the period and split user
      const quota = allQuotas.find(
        (q) => q.userId === split.userId && q.period === period,
      );
      const quotaTarget = quota ? quota.targetAmount : null;

      // Fetch other commissions for this user
      const userComms = allCommissions.filter(
        (comm) => comm.userId === split.userId,
      );
      const priorTotalSum = userComms.reduce(
        (sum, comm) => sum + (Number.parseFloat(comm.amount) || 0),
        0,
      );

      const calculation = calculateOpportunityCommission({
        opportunityAmount: split.splitAmount,
        opportunityStage: opportunity.stage,
        quotaTarget,
        currentClosedWonTotal: String(priorTotalSum),
        baseRate,
      });

      const newCommission = await dbStore.commissions.insert({
        orgId: tenant.orgId,
        userId: split.userId,
        opportunityId: opportunity.id,
        amount: calculation.commissionAmount,
        rateApplied: calculation.rateApplied,
        status: "Pending",
      });
      insertedCommissions.push(newCommission);

      // Log audit for each
      await dbStore.auditLogs.insert({
        orgId: tenant.orgId,
        recordId: newCommission.id,
        recordType: "Commission",
        action: "calculate",
        userId: tenant.userId,
        changes: null,
      });
    }

    return c.json({ success: true, data: insertedCommissions });
  }

  // 5. Fetch quota for the period and owner
  const allQuotas = await dbStore.quotas.findMany();
  const quota = allQuotas.find(
    (q) => q.userId === opportunity.ownerId && q.period === period,
  );
  const quotaTarget = quota ? quota.targetAmount : null;

  // 6. Fetch other Closed Won opportunities for the same owner in the same period
  const allOpps = await dbStore.opportunities.findMany();
  const priorClosedWonOpps = allOpps.filter(
    (o) =>
      o.ownerId === opportunity.ownerId &&
      o.stage === "Closed Won" &&
      o.id !== opportunityId &&
      o.closeDate &&
      new Date(o.closeDate).toISOString().substring(0, 7) === period,
  );

  const priorTotalSum = priorClosedWonOpps.reduce(
    (sum, o) => sum + (Number.parseFloat(o.amount || "0") || 0),
    0,
  );

  // 7. Calculate
  const calculation = calculateOpportunityCommission({
    opportunityAmount: opportunity.amount || "0",
    opportunityStage: opportunity.stage,
    quotaTarget,
    currentClosedWonTotal: String(priorTotalSum),
    baseRate,
  });

  // 8. Insert record
  const newCommission = await dbStore.commissions.insert({
    orgId: tenant.orgId,
    userId: opportunity.ownerId,
    opportunityId: opportunity.id,
    amount: calculation.commissionAmount,
    rateApplied: calculation.rateApplied,
    status: "Pending",
  });

  // 9. Log audit
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newCommission.id,
    recordType: "Commission",
    action: "calculate",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: newCommission });
});

commissionsApp.get("/", tenantAuth, async (c) => {
  const list = await dbStore.commissions.findMany();
  return c.json({ success: true, data: list });
});

commissionsApp.post("/:id/approve", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const commission = await dbStore.commissions.findOne(id);
  if (!commission) {
    return c.json({ error: "Commission not found" }, 404);
  }

  if (commission.status !== "Pending") {
    return c.json({ error: "Commission is not pending approval." }, 400);
  }

  const updated = await dbStore.commissions.update(id, {
    status: "Approved",
  });

  // Log audit
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Commission",
    action: "approve",
    userId: tenant.userId,
    changes: {
      status: { before: "Pending", after: "Approved" },
    },
  });

  return c.json({ success: true, data: updated });
});
quotasApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { userId, period, targetAmount } = body;

  if (!userId || !period || targetAmount === undefined) {
    return c.json({ error: "Missing required quota parameters" }, 400);
  }

  const newQuota = await dbStore.quotas.insert({
    orgId: tenant.orgId,
    userId,
    period,
    targetAmount: String(targetAmount),
  });

  return c.json({ success: true, data: newQuota });
});

quotasApp.get("/", tenantAuth, async (c) => {
  const quotas = await dbStore.quotas.findMany();
  return c.json({ success: true, data: quotas });
});
