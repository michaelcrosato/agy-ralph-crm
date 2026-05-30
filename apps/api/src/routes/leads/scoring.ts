import { calculateLeadScore } from "@crm/core";
import { dbStore } from "@crm/db";
import { OpenAPIHono } from "@hono/zod-openapi";
import { checkAndRunLeadAutoConversion } from "../../lib/leadAutoConversion";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const scoringRouter = new OpenAPIHono<Env>();
export const leadScoringRulesApp = new OpenAPIHono<Env>();

scoringRouter.use(tenantAuth);
leadScoringRulesApp.use(tenantAuth);

scoringRouter.get("/:id/score", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found." }, 404);
  }
  const rules = await dbStore.leadScoringRules.findMany();
  const score = calculateLeadScore(
    lead as unknown as Record<string, unknown>,
    rules.map((r) => ({
      id: r.id,
      isActive: r.isActive,
      scoreValue: r.scoreValue,
      criteria: r.criteria,
    })),
  );
  return c.json({ leadId: id, score });
});

scoringRouter.post("/:id/score/recalculate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found." }, 404);
  }
  const rules = await dbStore.leadScoringRules.findMany();
  const score = calculateLeadScore(
    lead as unknown as Record<string, unknown>,
    rules.map((r) => ({
      id: r.id,
      isActive: r.isActive,
      scoreValue: r.scoreValue,
      criteria: r.criteria,
    })),
  );

  const custom = lead.custom || {};
  const updatedCustom = { ...custom, score };

  const updatedLead = await dbStore.leads.update(id, {
    custom: updatedCustom,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "leads",
    action: "recalculate_score",
    userId: tenant.userId,
    changes: {
      score: { before: custom.score, after: score },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "lead.score_updated", {
    leadId: id,
    score,
  });

  // Run auto-conversion check
  const autoConvertResult = await checkAndRunLeadAutoConversion(
    id,
    tenant.orgId,
    tenant.userId,
  );

  return c.json({
    success: true,
    data: updatedLead,
    autoConverted: autoConvertResult || null,
  });
});

leadScoringRulesApp.get("/", tenantAuth, async (c) => {
  const rules = await dbStore.leadScoringRules.findMany();
  return c.json({ data: rules });
});

leadScoringRulesApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  if (
    !body.name ||
    !Array.isArray(body.criteria) ||
    body.scoreValue === undefined
  ) {
    return c.json(
      { error: "Missing name, criteria, or scoreValue in request body." },
      400,
    );
  }
  const newRule = await dbStore.leadScoringRules.insert({
    orgId: tenant.orgId,
    name: body.name,
    criteria: body.criteria,
    scoreValue: Number(body.scoreValue),
    isActive: body.isActive !== undefined ? Number(body.isActive) : 1,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newRule.id,
    recordType: "lead_scoring_rules",
    action: "create",
    userId: tenant.userId,
    changes: { rule: { before: null, after: newRule } },
  });

  return c.json({ success: true, data: newRule }, 201);
});
