import {
  calculateOpportunityCommission,
  calculateOpportunitySplits,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../../middleware/tenantAuth";

export const splitsApp = new Hono<Env>();

splitsApp.get("/:id/splits", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const splits = await dbStore.opportunitySplits.findForOpportunity(id);
  return c.json({ success: true, data: splits });
});

splitsApp.post("/:id/splits", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const body = await c.req.json();
  const splitsInput = body.splits;
  if (!Array.isArray(splitsInput) || splitsInput.length === 0) {
    return c.json({ error: "splits must be a non-empty array" }, 400);
  }

  let calculatedSplits: ReturnType<typeof calculateOpportunitySplits>;
  try {
    calculatedSplits = calculateOpportunitySplits(
      opportunity.amount || "0",
      splitsInput,
    );
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      400,
    );
  }

  // Delete existing splits for this opportunity
  await dbStore.opportunitySplits.deleteManyForOpportunity(id);

  const insertedSplits = [];
  for (const s of calculatedSplits) {
    const ins = await dbStore.opportunitySplits.insert({
      orgId: tenant.orgId,
      opportunityId: id,
      userId: s.userId,
      percentage: s.percentage,
      splitAmount: s.splitAmount,
    });
    insertedSplits.push(ins);
  }

  // Update commissions!
  // Delete existing commissions for this opportunity
  await dbStore.commissions.deleteManyForOpportunity(id);

  // If the opportunity is Closed Won, calculate and insert new split commissions
  if (opportunity.stage === "Closed Won") {
    const quotas = await dbStore.quotas.findMany();
    const allCommissions = await dbStore.commissions.findMany();

    for (const split of insertedSplits) {
      const userQuota = quotas.find((q) => q.userId === split.userId);
      const userComms = allCommissions.filter(
        (comm) => comm.userId === split.userId,
      );
      const userTotalClosedWon = userComms.reduce(
        (sum, comm) => sum + (Number.parseFloat(comm.amount) || 0),
        0,
      );

      const commResult = calculateOpportunityCommission({
        opportunityAmount: split.splitAmount,
        opportunityStage: "Closed Won",
        quotaTarget: userQuota ? userQuota.targetAmount : null,
        currentClosedWonTotal: String(userTotalClosedWon),
      });

      await dbStore.commissions.insert({
        orgId: tenant.orgId,
        userId: split.userId,
        opportunityId: id,
        amount: commResult.commissionAmount,
        rateApplied: commResult.rateApplied,
        status: "Pending",
      });
    }
  }

  // Audit Log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "update_splits",
    userId: tenant.userId,
    changes: {
      splits: { before: null, after: splitsInput },
    },
  });

  return c.json({ success: true, data: insertedSplits });
});

splitsApp.delete("/:id/splits", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  // Delete all splits for this opportunity
  await dbStore.opportunitySplits.deleteManyForOpportunity(id);

  // Revert commissions back to 100% to owner if Closed Won
  await dbStore.commissions.deleteManyForOpportunity(id);

  if (opportunity.stage === "Closed Won") {
    const quotas = await dbStore.quotas.findMany();
    const allCommissions = await dbStore.commissions.findMany();

    const ownerQuota = quotas.find((q) => q.userId === opportunity.ownerId);
    const ownerComms = allCommissions.filter(
      (comm) => comm.userId === opportunity.ownerId,
    );
    const ownerTotalClosedWon = ownerComms.reduce(
      (sum, comm) => sum + (Number.parseFloat(comm.amount) || 0),
      0,
    );

    const commResult = calculateOpportunityCommission({
      opportunityAmount: opportunity.amount || "0",
      opportunityStage: "Closed Won",
      quotaTarget: ownerQuota ? ownerQuota.targetAmount : null,
      currentClosedWonTotal: String(ownerTotalClosedWon),
    });

    await dbStore.commissions.insert({
      orgId: tenant.orgId,
      userId: opportunity.ownerId,
      opportunityId: id,
      amount: commResult.commissionAmount,
      rateApplied: commResult.rateApplied,
      status: "Pending",
    });
  }

  // Audit Log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "delete_splits",
    userId: tenant.userId,
    changes: {
      splits: { before: "exists", after: null },
    },
  });

  return c.json({ success: true });
});
