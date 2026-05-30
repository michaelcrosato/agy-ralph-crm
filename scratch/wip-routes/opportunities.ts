import {
  calculateCampaignRevenueShare,
  calculateCPQPrice,
  calculateOpportunityCommission,
  calculateOpportunitySplits,
  calculateStalledOpportunities,
  compileKanbanPipeline,
  generateStraightLineSchedules,
  rollupOpportunityAmount,
  type StageGateRule,
  setPrimaryOpportunityContactRole,
  validateInfluencePercentageTotal,
  validateOpportunityApprovalSubmission,
  validateOpportunityProductSchedule,
  validateOpportunityStageGate,
  validateOpportunityTeamMember,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { compileTemplate } from "@crm/documents";
import { executeWorkflows } from "@crm/workflow";
import { Hono } from "hono";
import {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "../lib/validation";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

export const opportunitiesApp = new Hono<Env>();

opportunitiesApp.get("/", tenantAuth, async (c) => {
  const opportunities = await dbStore.opportunities.findMany();
  return c.json({ success: true, data: opportunities });
});

opportunitiesApp.get("/kanban", tenantAuth, async (c) => {
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

opportunitiesApp.post("/kanban/transition", tenantAuth, async (c) => {
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

opportunitiesApp.get("/stalled", tenantAuth, async (c) => {
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

opportunitiesApp.get("/stalled/rules", tenantAuth, async (c) => {
  const rules = await dbStore.opportunityStageDurationRules.findMany();
  return c.json({ success: true, data: rules });
});

opportunitiesApp.post("/stalled/rules", tenantAuth, async (c) => {
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

opportunitiesApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  return c.json({ success: true, data: opportunity });
});

opportunitiesApp.post("/", tenantAuth, async (c) => {
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

opportunitiesApp.patch("/:id", tenantAuth, async (c) => {
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

opportunitiesApp.get("/:id/stage-history", tenantAuth, async (c) => {
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

opportunitiesApp.post("/:oppId/products", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const oppId = c.req.param("oppId");
  const body = await c.req.json().catch(() => ({}));
  const { pricebookEntryId, quantity, unitPrice } = body;

  if (!pricebookEntryId || quantity === undefined) {
    return c.json({ error: "Missing required line item parameters" }, 400);
  }

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const entry = await dbStore.pricebookEntries.findOne(pricebookEntryId);
  if (!entry) {
    return c.json({ error: "Pricebook entry not found" }, 404);
  }

  const finalUnitPrice =
    unitPrice !== undefined ? String(unitPrice) : entry.unitPrice;
  const finalQuantity = Number(quantity);
  const totalPrice = String(finalQuantity * Number.parseFloat(finalUnitPrice));

  const lineItem = await dbStore.opportunityProducts.insert({
    orgId: tenant.orgId,
    opportunityId: oppId,
    pricebookEntryId,
    quantity: finalQuantity,
    unitPrice: finalUnitPrice,
    totalPrice,
  });

  // Calculate Rollup
  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);
  const newAmount = rollupOpportunityAmount(oppLines);

  await dbStore.opportunities.update(oppId, { amount: newAmount });

  return c.json({
    success: true,
    data: lineItem,
    opportunityAmount: newAmount,
  });
});

opportunitiesApp.get("/:oppId/products", tenantAuth, async (c) => {
  const oppId = c.req.param("oppId");

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);

  return c.json({ success: true, data: oppLines });
});

opportunitiesApp.patch(
  "/:oppId/products/:lineItemId",
  tenantAuth,
  async (c) => {
    const oppId = c.req.param("oppId");
    const lineItemId = c.req.param("lineItemId");
    const body = await c.req.json().catch(() => ({}));
    const { quantity, unitPrice } = body;

    const opportunity = await dbStore.opportunities.findOne(oppId);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const existingLine = await dbStore.opportunityProducts.findOne(lineItemId);
    if (!existingLine || existingLine.opportunityId !== oppId) {
      return c.json({ error: "Opportunity product not found" }, 404);
    }

    const finalQuantity =
      quantity !== undefined ? Number(quantity) : existingLine.quantity;
    const finalUnitPrice =
      unitPrice !== undefined ? String(unitPrice) : existingLine.unitPrice;
    const totalPrice = String(
      finalQuantity * Number.parseFloat(finalUnitPrice),
    );

    const updatedLine = await dbStore.opportunityProducts.update(lineItemId, {
      quantity: finalQuantity,
      unitPrice: finalUnitPrice,
      totalPrice,
    });

    // Recalculate Rollup
    const allLines = await dbStore.opportunityProducts.findMany();
    const oppLines = allLines.filter((x) => x.opportunityId === oppId);
    const newAmount = rollupOpportunityAmount(oppLines);

    await dbStore.opportunities.update(oppId, { amount: newAmount });

    return c.json({
      success: true,
      data: updatedLine,
      opportunityAmount: newAmount,
    });
  },
);

opportunitiesApp.delete(
  "/:oppId/products/:lineItemId",
  tenantAuth,
  async (c) => {
    const oppId = c.req.param("oppId");
    const lineItemId = c.req.param("lineItemId");

    const opportunity = await dbStore.opportunities.findOne(oppId);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const existingLine = await dbStore.opportunityProducts.findOne(lineItemId);
    if (!existingLine || existingLine.opportunityId !== oppId) {
      return c.json({ error: "Opportunity product not found" }, 404);
    }

    await dbStore.opportunityProducts.delete(lineItemId);

    // Recalculate Rollup
    const allLines = await dbStore.opportunityProducts.findMany();
    const oppLines = allLines.filter((x) => x.opportunityId === oppId);
    const newAmount = rollupOpportunityAmount(oppLines);

    await dbStore.opportunities.update(oppId, { amount: newAmount });

    return c.json({ success: true, opportunityAmount: newAmount });
  },
);

opportunitiesApp.post("/:oppId/quote", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const oppId = c.req.param("oppId");
  const body = await c.req.json().catch(() => ({}));
  const { templateId, customDiscountPercentage } = body;

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  let accountName = "N/A";
  if (opportunity.accountId) {
    const account = await dbStore.accounts.findOne(opportunity.accountId);
    if (account) {
      accountName = account.name;
    }
  }

  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);

  let totalQuoteValue = 0;
  const lineItemRows: string[] = [];

  for (const line of oppLines) {
    let productName = "Unknown Product";
    const entry = await dbStore.pricebookEntries.findOne(line.pricebookEntryId);
    if (entry) {
      const product = await dbStore.products.findOne(entry.productId);
      if (product) {
        productName = product.name;
      }
    }

    const calc = calculateCPQPrice({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      customDiscountPercentage,
    });

    const sub = Number.parseFloat(calc.subtotal) || 1;
    const discountPct =
      ((sub - (Number.parseFloat(calc.totalPrice) || 0)) / sub) * 100;

    lineItemRows.push(
      `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${productName}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${line.quantity}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${Number.parseFloat(line.unitPrice).toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${discountPct.toFixed(0)}% (-$${Number.parseFloat(calc.discountAmount).toFixed(2)})</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${Number.parseFloat(calc.totalPrice).toFixed(2)}</td>
      </tr>`,
    );

    totalQuoteValue += Number.parseFloat(calc.totalPrice) || 0;
  }

  const lineItemsTable = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Product</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Qty</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Unit Price</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Discount</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows.length > 0 ? lineItemRows.join("\n") : '<tr><td colspan="5" style="padding: 8px; border: 1px solid #ddd; text-align: center;">No products configured</td></tr>'}
      </tbody>
    </table>
  `;

  const updatedOppAmount = totalQuoteValue.toFixed(2);
  await dbStore.opportunities.update(oppId, { amount: updatedOppAmount });

  let templateContent = "";
  let matchedTemplateId = templateId;

  if (templateId) {
    const template = await dbStore.documentTemplates.findOne(templateId);
    if (!template) {
      return c.json({ error: "Document template not found" }, 404);
    }
    templateContent = template.content;
  } else {
    const templates = await dbStore.documentTemplates.findMany();
    const standardQuoteTemplate = templates.find(
      (t) => t.name === "Standard Quote Template",
    );

    if (standardQuoteTemplate) {
      templateContent = standardQuoteTemplate.content;
      matchedTemplateId = standardQuoteTemplate.id;
    } else {
      const newTemplate = await dbStore.documentTemplates.insert({
        orgId: tenant.orgId,
        name: "Standard Quote Template",
        content: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">PROPOSAL & QUOTE</h2>
            <div style="margin-top: 15px; margin-bottom: 15px;">
              <p><strong>Prepared For:</strong> {{Account.name}}</p>
              <p><strong>Opportunity Name:</strong> {{Opportunity.name}}</p>
              <p><strong>Date:</strong> {{Date}}</p>
            </div>
            {{LineItemsTable}}
            <div style="margin-top: 20px; text-align: right; font-size: 1.2em;">
              <strong>Total Proposed Value:</strong> \${{Opportunity.amount}}
            </div>
          </div>
        `.trim(),
      });
      templateContent = newTemplate.content;
      matchedTemplateId = newTemplate.id;
    }
  }

  const context: Record<string, unknown> = {
    Account: { name: accountName },
    Opportunity: {
      name: opportunity.name,
      amount: updatedOppAmount,
    },
    Date: new Date().toISOString().substring(0, 10),
    LineItemsTable: lineItemsTable,
  };

  const compiledContent = compileTemplate(templateContent, context);

  const mergedDoc = await dbStore.mergedDocuments.insert({
    orgId: tenant.orgId,
    templateId: matchedTemplateId,
    recordType: "Opportunity",
    recordId: oppId,
    compiledContent,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: oppId,
    recordType: "Opportunity",
    action: "generate_quote",
    userId: tenant.userId,
    changes: {
      quoteId: { before: null, after: mergedDoc.id },
      amount: { before: opportunity.amount, after: updatedOppAmount },
    },
  });

  return c.json({
    success: true,
    data: {
      mergedDocumentId: mergedDoc.id,
      compiledContent,
      subtotal: oppLines
        .reduce(
          (acc, l) => acc + l.quantity * Number.parseFloat(l.unitPrice),
          0,
        )
        .toFixed(2),
      discountAmount: oppLines
        .reduce((acc, l) => {
          const calc = calculateCPQPrice({
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            customDiscountPercentage,
          });
          return acc + Number.parseFloat(calc.discountAmount);
        }, 0)
        .toFixed(2),
      totalPrice: updatedOppAmount,
    },
  });
});

opportunitiesApp.get("/:oppId/quote", tenantAuth, async (c) => {
  const oppId = c.req.param("oppId");

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const allMerged = await dbStore.mergedDocuments.findMany();
  const opportunityQuotes = allMerged.filter(
    (doc) => doc.recordType === "Opportunity" && doc.recordId === oppId,
  );

  if (opportunityQuotes.length === 0) {
    return c.json(
      { error: "No quote generated for this opportunity yet." },
      404,
    );
  }

  opportunityQuotes.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return c.json({
    success: true,
    data: opportunityQuotes[0],
  });
});

opportunitiesApp.post("/:id/submit-approval", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const tenant = c.get("tenant");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  // Ensure only one pending approval exists for an opportunity at any time
  const approvals = await dbStore.opportunityApprovals.findMany();
  const existingPending = approvals.find(
    (a) => a.opportunityId === id && a.status === "Pending",
  );
  if (existingPending) {
    return c.json(
      { error: "Opportunity already has a pending approval submission" },
      400,
    );
  }

  // Core validation check
  const validation = validateOpportunityApprovalSubmission(opportunity);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  // Insert approval record
  const approval = await dbStore.opportunityApprovals.insert({
    orgId: tenant.orgId,
    opportunityId: id,
    submitterId: tenant.userId,
    status: "Pending",
  });

  // Create standard multi-stage approval steps
  const step1 = await dbStore.opportunityApprovalSteps.insert({
    orgId: tenant.orgId,
    approvalId: approval.id,
    stepName: "Manager Review",
    approverRoleId: "role-manager",
    status: "Pending",
    decidedByUserId: null,
    comments: null,
    decidedAt: null,
  });

  const step2 = await dbStore.opportunityApprovalSteps.insert({
    orgId: tenant.orgId,
    approvalId: approval.id,
    stepName: "VP Review",
    approverRoleId: "role-vp",
    status: "Pending",
    decidedByUserId: null,
    comments: null,
    decidedAt: null,
  });

  // Log submission audit log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: approval.id,
    recordType: "OpportunityApproval",
    action: "submit",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({
    success: true,
    data: {
      ...approval,
      steps: [step1, step2],
    },
  });
});

opportunitiesApp.get("/:id/approvals", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const allApprovals = await dbStore.opportunityApprovals.findMany();
  const opportunityApprovals = allApprovals.filter(
    (a) => a.opportunityId === id,
  );

  const allSteps = await dbStore.opportunityApprovalSteps.findMany();

  const data = opportunityApprovals.map((approval) => {
    const steps = allSteps.filter((s) => s.approvalId === approval.id);
    return {
      ...approval,
      steps,
    };
  });

  return c.json({ success: true, data });
});

opportunitiesApp.get("/:id/splits", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const splits = await dbStore.opportunitySplits.findForOpportunity(id);
  return c.json({ success: true, data: splits });
});

opportunitiesApp.post("/:id/splits", tenantAuth, async (c) => {
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

opportunitiesApp.delete("/:id/splits", tenantAuth, async (c) => {
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

opportunitiesApp.get("/:id/contact-roles", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const roles = await dbStore.opportunityContactRoles.findForOpportunity(id);
  return c.json({ success: true, data: roles });
});

opportunitiesApp.post("/:id/contact-roles", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { contactId, role, isPrimary } = body;

  if (!contactId || !role) {
    return c.json(
      { error: "Missing required parameters: contactId or role" },
      400,
    );
  }

  const contact = await dbStore.contacts.findOne(contactId);
  if (!contact) {
    return c.json({ error: "Contact not found" }, 404);
  }

  const existing = await dbStore.opportunityContactRoles.findForOpportunity(id);
  const hasDuplicate = existing.some((r) => r.contactId === contactId);
  if (hasDuplicate) {
    return c.json(
      { error: "Contact is already assigned to this opportunity" },
      400,
    );
  }

  if (isPrimary) {
    const updatedRoles = setPrimaryOpportunityContactRole(
      existing,
      id,
      contactId,
    );
    for (const r of updatedRoles) {
      if (!r.isPrimary && existing.find((x) => x.id === r.id)?.isPrimary) {
        await dbStore.opportunityContactRoles.update(r.id, {
          isPrimary: false,
        });
      }
    }
  }

  const newRole = await dbStore.opportunityContactRoles.insert({
    orgId: tenant.orgId,
    opportunityId: id,
    contactId,
    role,
    isPrimary: !!isPrimary,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "add_contact_role",
    userId: tenant.userId,
    changes: {
      contactRole: { before: null, after: newRole },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "opportunity.contact_role.created",
    {
      orgId: tenant.orgId,
      opportunityId: id,
      contactId,
      roleId: newRole.id,
      role,
      isPrimary: !!isPrimary,
    },
  );

  return c.json({ success: true, data: newRole });
});

opportunitiesApp.put("/:id/contact-roles/:roleId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const roleId = c.req.param("roleId");

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const currentRole = await dbStore.opportunityContactRoles.findOne(roleId);
  if (!currentRole || currentRole.opportunityId !== id) {
    return c.json({ error: "Contact role not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { role, isPrimary } = body;

  const updates: Partial<
    Omit<typeof currentRole, "id" | "orgId" | "createdAt">
  > = {};
  if (role !== undefined) updates.role = role;
  if (isPrimary !== undefined) updates.isPrimary = !!isPrimary;

  if (isPrimary) {
    const existing =
      await dbStore.opportunityContactRoles.findForOpportunity(id);
    const updatedRoles = setPrimaryOpportunityContactRole(
      existing,
      id,
      currentRole.contactId,
    );
    for (const r of updatedRoles) {
      if (!r.isPrimary && existing.find((x) => x.id === r.id)?.isPrimary) {
        await dbStore.opportunityContactRoles.update(r.id, {
          isPrimary: false,
        });
      }
    }
  }

  const updatedRole = await dbStore.opportunityContactRoles.update(
    roleId,
    updates,
  );

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "update_contact_role",
    userId: tenant.userId,
    changes: {
      contactRole: { before: currentRole, after: updatedRole },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "opportunity.contact_role.updated",
    {
      orgId: tenant.orgId,
      opportunityId: id,
      contactId: currentRole.contactId,
      roleId,
      role: updatedRole?.role,
      isPrimary: updatedRole?.isPrimary,
    },
  );

  return c.json({ success: true, data: updatedRole });
});

opportunitiesApp.delete("/:id/contact-roles/:roleId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const roleId = c.req.param("roleId");

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const currentRole = await dbStore.opportunityContactRoles.findOne(roleId);
  if (!currentRole || currentRole.opportunityId !== id) {
    return c.json({ error: "Contact role not found" }, 404);
  }

  await dbStore.opportunityContactRoles.delete(roleId);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "remove_contact_role",
    userId: tenant.userId,
    changes: {
      contactRole: { before: currentRole, after: null },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "opportunity.contact_role.deleted",
    {
      orgId: tenant.orgId,
      opportunityId: id,
      contactId: currentRole.contactId,
      roleId,
    },
  );

  return c.json({ success: true });
});

opportunitiesApp.get("/:id/campaign-influence", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opp = await dbStore.opportunities.findOne(id);
  if (!opp) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const influences = await dbStore.campaignInfluence.findForOpportunity(id);
  return c.json({ success: true, data: influences });
});

opportunitiesApp.post("/:id/campaign-influence", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const opp = await dbStore.opportunities.findOne(id);
  if (!opp) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { campaignId, influencePercentage } = body;

  if (!campaignId || influencePercentage === undefined) {
    return c.json(
      { error: "campaignId and influencePercentage are required" },
      400,
    );
  }

  const pct = Number.parseInt(influencePercentage, 10);
  if (Number.isNaN(pct) || pct < 0 || pct > 100) {
    return c.json(
      { error: "influencePercentage must be an integer between 0 and 100" },
      400,
    );
  }

  const existingInfluences =
    await dbStore.campaignInfluence.findForOpportunity(id);

  const alreadyLinked = existingInfluences.some(
    (i) => i.campaignId === campaignId,
  );
  if (alreadyLinked) {
    return c.json(
      { error: "Campaign already has an influence record on this opportunity" },
      400,
    );
  }

  const valid = validateInfluencePercentageTotal(existingInfluences, pct);
  if (!valid) {
    return c.json(
      { error: "Total campaign influence percentage cannot exceed 100%" },
      400,
    );
  }

  const amount = opp.amount || "0";
  const revenueShare = calculateCampaignRevenueShare(amount, pct);

  const newInfluence = await dbStore.campaignInfluence.insert({
    orgId: tenant.orgId,
    opportunityId: id,
    campaignId,
    influencePercentage: pct,
    revenueShare,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "add_campaign_influence",
    userId: tenant.userId,
    changes: {
      campaignInfluence: { before: null, after: newInfluence },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "opportunity.campaign_influence.created",
    newInfluence as unknown as Record<string, unknown>,
  );

  return c.json({ success: true, data: newInfluence }, 201);
});

opportunitiesApp.delete(
  "/:id/campaign-influence/:influenceId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const influenceId = c.req.param("influenceId");

    const opp = await dbStore.opportunities.findOne(id);
    if (!opp) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const currentInfluence =
      await dbStore.campaignInfluence.findOne(influenceId);
    if (!currentInfluence || currentInfluence.opportunityId !== id) {
      return c.json({ error: "Campaign influence record not found" }, 404);
    }

    await dbStore.campaignInfluence.delete(influenceId);

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "opportunities",
      action: "remove_campaign_influence",
      userId: tenant.userId,
      changes: {
        campaignInfluence: { before: currentInfluence, after: null },
      },
    });

    await triggerOutboundWebhooks(
      tenant.orgId,
      "opportunity.campaign_influence.deleted",
      {
        orgId: tenant.orgId,
        opportunityId: id,
        campaignId: currentInfluence.campaignId,
        id: influenceId,
      },
    );

    return c.json({ success: true });
  },
);

opportunitiesApp.get("/:id/competitors", tenantAuth, async (c) => {
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

opportunitiesApp.post("/:id/competitors", tenantAuth, async (c) => {
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

opportunitiesApp.put(
  "/:id/competitors/:competitorId",
  tenantAuth,
  async (c) => {
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

    const competitor =
      await dbStore.opportunityCompetitors.findOne(competitorId);
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
  },
);

opportunitiesApp.delete(
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

opportunitiesApp.get("/:id/team", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const team = await dbStore.opportunityTeams.findForOpportunity(id);
  return c.json({ success: true, data: team });
});

opportunitiesApp.post("/:id/team", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const userId = body.userId;
  const role = body.role;

  const validation = validateOpportunityTeamMember(id, userId, role);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const team = await dbStore.opportunityTeams.findForOpportunity(id);
  const priorMember = team.find((t) => t.userId === userId);
  const action = priorMember
    ? "opportunity_team_member_updated"
    : "opportunity_team_member_added";

  const updatedMember = await dbStore.opportunityTeams.addOrUpdateMember(
    id,
    userId,
    role,
  );

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action,
    userId: tenant.userId,
    changes: {
      teamMember: { before: priorMember || null, after: updatedMember },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "opportunity.team_updated", {
    opportunityId: id,
    userId,
    role,
    action,
  });

  return c.json(
    { success: true, data: updatedMember },
    priorMember ? 200 : 201,
  );
});

opportunitiesApp.delete("/:id/team/:userId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const userId = c.req.param("userId");

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const team = await dbStore.opportunityTeams.findForOpportunity(id);
  const priorMember = team.find((t) => t.userId === userId);
  if (!priorMember) {
    return c.json({ error: "Team member not found on this opportunity" }, 404);
  }

  await dbStore.opportunityTeams.removeMember(id, userId);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "opportunity_team_member_removed",
    userId: tenant.userId,
    changes: {
      teamMember: { before: priorMember, after: null },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "opportunity.team_updated", {
    opportunityId: id,
    userId,
    action: "opportunity_team_member_removed",
  });

  return c.json({ success: true });
});

opportunitiesApp.get(
  "/:id/products/:productId/schedules",
  tenantAuth,
  async (c) => {
    const id = c.req.param("id");
    const productId = c.req.param("productId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const oppProd = await dbStore.opportunityProducts.findOne(productId);
    if (!oppProd || oppProd.opportunityId !== id) {
      return c.json({ error: "Opportunity Product line item not found" }, 404);
    }

    const schedules =
      await dbStore.opportunityProductSchedules.findForProduct(productId);
    return c.json({ success: true, data: schedules });
  },
);

opportunitiesApp.post(
  "/:id/products/:productId/schedules",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const productId = c.req.param("productId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const oppProd = await dbStore.opportunityProducts.findOne(productId);
    if (!oppProd || oppProd.opportunityId !== id) {
      return c.json({ error: "Opportunity Product line item not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const scheduleType = body.scheduleType || "revenue";
    const scheduleDate = new Date(body.scheduleDate);
    const amount = body.amount;
    const description = body.description || null;

    const validation = validateOpportunityProductSchedule(
      productId,
      scheduleType,
      scheduleDate,
      amount,
    );
    if (!validation.success) {
      return c.json({ error: validation.error }, 400);
    }

    const newSchedule = await dbStore.opportunityProductSchedules.insert({
      orgId: tenant.orgId,
      opportunityProductId: productId,
      scheduleType,
      scheduleDate,
      amount,
      description,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: newSchedule.id,
      recordType: "opportunity_product_schedules",
      action: "create",
      userId: tenant.userId,
      changes: { schedule: { before: null, after: newSchedule } },
    });

    await triggerOutboundWebhooks(
      tenant.orgId,
      "opportunity_product_schedule.created",
      {
        scheduleId: newSchedule.id,
        opportunityProductId: productId,
        scheduleType,
      },
    );

    return c.json({ success: true, data: newSchedule }, 201);
  },
);

opportunitiesApp.delete(
  "/:id/products/:productId/schedules/:scheduleId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const productId = c.req.param("productId");
    const scheduleId = c.req.param("scheduleId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const oppProd = await dbStore.opportunityProducts.findOne(productId);
    if (!oppProd || oppProd.opportunityId !== id) {
      return c.json({ error: "Opportunity Product line item not found" }, 404);
    }

    const schedule =
      await dbStore.opportunityProductSchedules.findOne(scheduleId);
    if (!schedule || schedule.opportunityProductId !== productId) {
      return c.json(
        { error: "Schedule not found on this product line item" },
        404,
      );
    }

    const deleted =
      await dbStore.opportunityProductSchedules.delete(scheduleId);

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: scheduleId,
      recordType: "opportunity_product_schedules",
      action: "delete",
      userId: tenant.userId,
      changes: { schedule: { before: schedule, after: null } },
    });

    await triggerOutboundWebhooks(
      tenant.orgId,
      "opportunity_product_schedule.deleted",
      {
        scheduleId,
        opportunityProductId: productId,
      },
    );

    return c.json({ success: deleted });
  },
);

opportunitiesApp.post(
  "/:id/products/:productId/schedules/generate",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const productId = c.req.param("productId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const oppProd = await dbStore.opportunityProducts.findOne(productId);
    if (!oppProd || oppProd.opportunityId !== id) {
      return c.json({ error: "Opportunity Product line item not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const periodsCount = Number.parseInt(body.periodsCount, 10) || 12;
    const startDate = new Date(body.startDate || new Date());
    const scheduleType = body.scheduleType || "revenue";

    if (periodsCount <= 0 || periodsCount > 60) {
      return c.json({ error: "Periods count must be between 1 and 60." }, 400);
    }
    if (Number.isNaN(startDate.getTime())) {
      return c.json({ error: "Invalid start date format." }, 400);
    }

    // Determine target total value to straight-line
    const targetTotal =
      scheduleType === "quantity"
        ? String(oppProd.quantity)
        : oppProd.totalPrice;

    // Generate schedules
    const generated = generateStraightLineSchedules(
      productId,
      targetTotal,
      periodsCount,
      startDate,
      scheduleType,
    );

    // RLS-aware replace
    await dbStore.opportunityProductSchedules.deleteForProduct(productId);

    const inserted: unknown[] = [];
    for (const s of generated) {
      const ins = await dbStore.opportunityProductSchedules.insert({
        orgId: tenant.orgId,
        opportunityProductId: s.opportunityProductId,
        scheduleType: s.scheduleType,
        scheduleDate: s.scheduleDate,
        amount: s.amount,
        description: s.description,
      });
      inserted.push(ins);
    }

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: productId,
      recordType: "opportunity_products",
      action: "schedules_generated",
      userId: tenant.userId,
      changes: { generatedCount: { before: 0, after: inserted.length } },
    });

    await triggerOutboundWebhooks(
      tenant.orgId,
      "opportunity_product_schedule.generated",
      {
        opportunityProductId: productId,
        count: inserted.length,
      },
    );

    return c.json(
      { success: true, count: inserted.length, data: inserted },
      201,
    );
  },
);
