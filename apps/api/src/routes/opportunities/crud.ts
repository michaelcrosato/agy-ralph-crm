import { type StageGateRule, validateOpportunityStageGate } from "@crm/core";
import { dbStore } from "@crm/db";
import { executeWorkflows } from "@crm/workflow";
import { Hono } from "hono";
import {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "../../lib/validation";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const crudApp = new Hono<Env>();

crudApp.get("/", tenantAuth, async (c) => {
  const opportunities = await dbStore.opportunities.findMany();
  return c.json({ success: true, data: opportunities });
});

crudApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  return c.json({ success: true, data: opportunity });
});

crudApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, stage, accountId, amount, closeDate, currencyCode } = body;

  if (!name || !stage || !accountId) {
    return c.json({ error: "Missing required opportunity parameters" }, 400);
  }

  // Validate picklist dependencies
  const pldValidation = await enforcePicklistDependencies("opportunities", {
    ...body,
    ...(body.custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  // Validate custom validation rules
  const customValValidation = await enforceCustomValidationRules(
    "opportunities",
    {
      ...body,
      ...(body.custom || {}),
    },
  );
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  let localCurrencyCode = currencyCode || "USD";
  let activeExchangeRate = "1.0000";
  const currencyObj = await dbStore.currencies.findByIsoCode(localCurrencyCode);
  if (currencyObj?.isActive) {
    activeExchangeRate = currencyObj.exchangeRate;
  } else {
    localCurrencyCode = "USD";
  }

  let amountCorporate: string | null = null;
  if (amount !== undefined && amount !== null) {
    const rate = Number.parseFloat(activeExchangeRate) || 1.0;
    amountCorporate = (Number.parseFloat(String(amount)) * rate).toFixed(2);
  }

  const opp = await dbStore.opportunities.insert({
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    accountId,
    name,
    stage,
    amount: amount !== undefined && amount !== null ? String(amount) : null,
    closeDate: closeDate ? new Date(closeDate) : null,
    custom: null,
    currencyCode: localCurrencyCode,
    amountCorporate,
  });

  await dbStore.opportunityStageHistory.insert({
    orgId: tenant.orgId,
    opportunityId: opp.id,
    fromStage: null,
    toStage: opp.stage,
    amount: opp.amount,
    changedById: tenant.userId,
  });

  return c.json({ success: true, data: opp });
});

crudApp.patch("/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { name, stage, amount, closeDate, currencyCode } = body;

  const existing = await dbStore.opportunities.findOne(id);
  if (!existing) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  // Validate picklist dependencies
  const combinedForValidation = {
    ...existing,
    ...body,
    custom: {
      ...(existing.custom || {}),
      ...(body.custom || {}),
    },
  };
  const pldValidation = await enforcePicklistDependencies("opportunities", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  // Validate custom validation rules
  const customValValidation = await enforceCustomValidationRules(
    "opportunities",
    {
      ...combinedForValidation,
      ...(combinedForValidation.custom || {}),
    },
  );
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  const updates: Parameters<typeof dbStore.opportunities.update>[1] = {};
  if (name !== undefined) updates.name = name;
  if (stage !== undefined) updates.stage = stage;
  if (closeDate !== undefined)
    updates.closeDate = closeDate !== null ? new Date(closeDate) : null;

  let localCurrencyCode =
    currencyCode !== undefined ? currencyCode : existing.currencyCode || "USD";
  const localAmount =
    amount !== undefined
      ? amount !== null
        ? String(amount)
        : null
      : existing.amount;

  let activeExchangeRate = "1.0000";
  const currencyObj = await dbStore.currencies.findByIsoCode(localCurrencyCode);
  if (currencyObj?.isActive) {
    activeExchangeRate = currencyObj.exchangeRate;
  } else {
    localCurrencyCode = "USD";
  }

  if (currencyCode !== undefined) {
    updates.currencyCode = localCurrencyCode;
  }
  if (amount !== undefined) {
    updates.amount = localAmount;
  }

  if (localAmount !== null && localAmount !== undefined) {
    const rate = Number.parseFloat(activeExchangeRate) || 1.0;
    updates.amountCorporate = (Number.parseFloat(localAmount) * rate).toFixed(
      2,
    );
  } else {
    updates.amountCorporate = null;
  }

  if (stage !== undefined && stage !== existing.stage) {
    const activeRules = await dbStore.opportunityStageGates.findMany();
    const mergedOpportunity = {
      ...existing,
      ...updates,
      stage,
    };
    const gateResult = validateOpportunityStageGate(
      mergedOpportunity as unknown as Record<string, unknown>,
      activeRules as StageGateRule[],
      stage,
    );
    if (!gateResult.isValid) {
      return c.json({ success: false, errors: gateResult.errorMessages }, 400);
    }
  }

  const updated = await dbStore.opportunities.update(id, updates);
  if (!updated) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  let workflowExecution:
    | { dispatchedWebhooks: string[]; notificationsCreated: string[] }
    | undefined;

  if (stage !== undefined && stage !== existing.stage) {
    await dbStore.opportunityStageHistory.insert({
      orgId: tenant.orgId,
      opportunityId: updated.id,
      fromStage: existing.stage,
      toStage: updated.stage,
      amount: updated.amount,
      changedById: tenant.userId,
    });

    const rules = await dbStore.workflows.findMany();
    workflowExecution = await executeWorkflows(
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
  }

  return c.json({
    success: true,
    data: updated,
    workflow: workflowExecution,
  });
});
