import {
  calculateStalledOpportunities,
  compileKanbanPipeline,
  type StageGateRule,
  validateOpportunityStageGate,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { executeWorkflows } from "@crm/workflow";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const opportunitiesStagesApp = new Hono<Env>();

opportunitiesStagesApp.get("/kanban", tenantAuth, async (c) => {
  const opportunities = await dbStore.opportunities.findMany();
  const compiled = compileKanbanPipeline(
    opportunities.map((o) => ({
      id: o.id,
      name: o.name,
      stage: o.stage,
      amount: o.amount ?? null,
      closeDate: o.closeDate ? new Date(o.closeDate) : null,
      accountId: o.accountId ?? null,
    })),
  );
  return c.json({ success: true, data: compiled });
});

opportunitiesStagesApp.post("/kanban/transition", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { opportunityId, targetStage } = body;

  if (!opportunityId || !targetStage) {
    return c.json(
      { error: "Missing required fields: opportunityId, targetStage" },
      400,
    );
  }

  const existing = await dbStore.opportunities.findOne(opportunityId);
  if (!existing) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  // Validate Stage Gates
  const activeRules = await dbStore.opportunityStageGates.findMany();
  const gateResult = validateOpportunityStageGate(
    { ...existing, stage: targetStage } as unknown as Record<string, unknown>,
    activeRules as StageGateRule[],
    targetStage,
  );
  if (!gateResult.isValid) {
    return c.json({ success: false, errors: gateResult.errorMessages }, 400);
  }

  const oldStage = existing.stage;
  const updated = await dbStore.opportunities.update(opportunityId, {
    stage: targetStage,
  });

  if (!updated) {
    return c.json({ error: "Failed to update opportunity" }, 500);
  }

  // Stage History
  const history = await dbStore.opportunityStageHistory.insert({
    orgId: tenant.orgId,
    opportunityId: updated.id,
    fromStage: oldStage,
    toStage: updated.stage,
    amount: updated.amount,
    changedById: tenant.userId,
  });

  // Audit Log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: updated.id,
    recordType: "Opportunity",
    action: "stage_changed",
    userId: tenant.userId,
    changes: {
      stage: { before: oldStage, after: updated.stage },
    },
  });

  // Execute Workflows
  const rules = await dbStore.workflows.findMany();
  const workflowExecution = await executeWorkflows(
    {
      name: "opportunity.stage_changed",
      payload: {
        id: updated.id,
        stage: updated.stage,
        amount: Number(updated.amount) || 0,
      },
    },
    rules.map((rule) => ({
      id: rule.id,
      triggerEvent: rule.triggerEvent,
      conditions: rule.conditions,
      actions: rule.actions,
    })),
    {
      dbStore,
      userId: tenant.userId,
      orgId: tenant.orgId,
    },
  );

  // Trigger Outbound Webhook
  await triggerOutboundWebhooks(updated.orgId, "opportunity.stage_changed", {
    id: updated.id,
    stage: updated.stage,
    amount: updated.amount,
  });

  return c.json({
    success: true,
    data: updated,
    history,
    workflow: workflowExecution,
  });
});

opportunitiesStagesApp.get("/stalled", tenantAuth, async (c) => {
  const opportunities = await dbStore.opportunities.findMany();
  const stageHistory = await dbStore.opportunityStageHistory.findMany();
  const rules = await dbStore.opportunityStageDurationRules.findMany();

  const stalled = calculateStalledOpportunities(
    opportunities.map((opp) => ({
      id: opp.id,
      name: opp.name,
      stage: opp.stage,
      amount: opp.amount ?? null,
    })),
    stageHistory.map((h) => ({
      opportunityId: h.opportunityId,
      toStage: h.toStage,
      createdAt: h.createdAt,
    })),
    rules.map((r) => ({
      stage: r.stage,
      maxDaysAllowed: r.maxDaysAllowed,
    })),
    new Date(),
  );

  return c.json({ success: true, data: stalled });
});

opportunitiesStagesApp.get("/stalled/rules", tenantAuth, async (c) => {
  const rules = await dbStore.opportunityStageDurationRules.findMany();
  return c.json({ success: true, data: rules });
});

opportunitiesStagesApp.post("/stalled/rules", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { stage, maxDaysAllowed } = body;

  if (!stage || typeof stage !== "string" || !stage.trim()) {
    return c.json(
      { error: "'stage' is required and must be a non-empty string" },
      400,
    );
  }

  if (
    typeof maxDaysAllowed !== "number" ||
    maxDaysAllowed <= 0 ||
    !Number.isInteger(maxDaysAllowed)
  ) {
    return c.json(
      { error: "'maxDaysAllowed' must be a positive integer greater than 0" },
      400,
    );
  }

  const upsertedRule = await dbStore.opportunityStageDurationRules.upsert({
    orgId: tenant.orgId,
    stage: stage.trim(),
    maxDaysAllowed,
  });

  return c.json({ success: true, data: upsertedRule });
});

opportunitiesStagesApp.get("/:id/stage-history", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const history = await dbStore.opportunityStageHistory.findForOpportunity(id);
  const sorted = [...history].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return c.json({ success: true, data: sorted });
});
