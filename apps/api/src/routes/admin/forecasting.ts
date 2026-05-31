import { calculateAdjustedForecast } from "@crm/core";
import { dbStore } from "@crm/db";
import {
  compileForecastCategorySummary,
  compileForecastSummary,
} from "@crm/forecasting";
import { Hono } from "hono";
import { resourceRbac } from "../../middleware/rbac";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const forecastsApp = new Hono<Env>();
export const forecastingApp = new Hono<Env>();

forecastsApp.use("*", tenantAuth, resourceRbac);
forecastingApp.use("*", tenantAuth, resourceRbac);

forecastsApp.get("/adjustments", tenantAuth, async (c) => {
  const adjustments = await dbStore.forecastAdjustments.findMany();
  return c.json({ success: true, data: adjustments });
});

forecastsApp.post("/adjustments", tenantAuth, async (c) => {
  const body = await c.req.json();
  const tenant = c.get("tenant");
  const newAdj = await dbStore.forecastAdjustments.insert({
    orgId: tenant.orgId,
    userId: body.userId,
    adjustedByUserId: tenant.userId,
    period: body.period,
    amount: body.amount,
    adjustmentType: body.adjustmentType,
    comments: body.comments || null,
  });
  return c.json({ success: true, data: newAdj });
});

forecastsApp.get("/adjusted-summary", tenantAuth, async (c) => {
  let period = c.req.query("period");
  if (!period) {
    period = new Date().toISOString().substring(0, 7);
  }

  const opportunities = await dbStore.opportunities.findMany();
  const quotas = await dbStore.quotas.findMany();
  const dbProbs = await dbStore.stageProbabilities.findMany();

  const customProbabilities: Record<string, number> = {};
  for (const p of dbProbs) {
    customProbabilities[p.stage] = p.probability;
  }

  const oppInputs = opportunities.map((opp) => ({
    id: opp.id,
    stage: opp.stage,
    amount: opp.amount,
    closeDate: opp.closeDate,
  }));

  const filteredOpps = oppInputs.filter((opp) => {
    if (!opp.closeDate) return false;
    try {
      const d = new Date(opp.closeDate);
      return (
        !Number.isNaN(d.getTime()) && d.toISOString().substring(0, 7) === period
      );
    } catch (_e) {
      return false;
    }
  });

  let closedWonAmount = 0;
  for (const opp of filteredOpps) {
    if (opp.stage === "Closed Won") {
      closedWonAmount += Number.parseFloat(opp.amount || "0") || 0;
    }
  }

  let totalQuota = 0;
  const filteredQuotas = quotas.filter((q) => q.period === period);
  for (const q of filteredQuotas) {
    totalQuota += Number.parseFloat(q.targetAmount) || 0;
  }

  const summary = compileForecastSummary({
    opportunities: filteredOpps,
    targetQuota: totalQuota,
    customProbabilities,
  });

  const adjustments = await dbStore.forecastAdjustments.findMany();
  const periodAdjustments = adjustments.filter((adj) => adj.period === period);

  const result = calculateAdjustedForecast({
    period,
    baseQuota: totalQuota,
    baseWeightedAmount: summary.totalWeightedAmount,
    closedWonAmount,
    adjustments: periodAdjustments.map((adj) => ({
      userId: adj.userId,
      period: adj.period,
      amount: adj.amount,
      adjustmentType: adj.adjustmentType,
    })),
  });

  return c.json({ success: true, data: result });
});

forecastingApp.post("/probabilities", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { stage, probability } = body;

  if (!stage || probability === undefined) {
    return c.json({ error: "Missing required probability fields" }, 400);
  }

  const val = Number.parseInt(probability, 10);
  if (Number.isNaN(val) || val < 0 || val > 100) {
    return c.json(
      { error: "Probability must be an integer between 0 and 100" },
      400,
    );
  }

  const newProb = await dbStore.stageProbabilities.upsert({
    orgId: tenant.orgId,
    stage,
    probability: val,
  });

  return c.json({ success: true, data: newProb });
});

forecastingApp.get("/probabilities", tenantAuth, async (c) => {
  const probs = await dbStore.stageProbabilities.findMany();
  return c.json({ success: true, data: probs });
});

forecastingApp.get("/summary", tenantAuth, async (c) => {
  const periodParam = c.req.query("period"); // e.g. ?period=2026-05

  const opportunities = await dbStore.opportunities.findMany();
  const quotas = await dbStore.quotas.findMany();
  const dbProbs = await dbStore.stageProbabilities.findMany();

  const customProbabilities: Record<string, number> = {};
  for (const p of dbProbs) {
    customProbabilities[p.stage] = p.probability;
  }

  const oppInputs = opportunities.map((opp) => ({
    id: opp.id,
    stage: opp.stage,
    amount: opp.amount,
    closeDate: opp.closeDate,
  }));

  let filteredOpps = oppInputs;
  if (periodParam) {
    filteredOpps = oppInputs.filter((opp) => {
      if (!opp.closeDate) return false;
      try {
        const d = new Date(opp.closeDate);
        return (
          !Number.isNaN(d.getTime()) &&
          d.toISOString().substring(0, 7) === periodParam
        );
      } catch (_e) {
        return false;
      }
    });
  }

  let totalQuota = 0;
  const filteredQuotas = periodParam
    ? quotas.filter((q) => q.period === periodParam)
    : quotas;
  for (const q of filteredQuotas) {
    totalQuota += Number.parseFloat(q.targetAmount) || 0;
  }

  const summary = compileForecastSummary({
    opportunities: filteredOpps,
    targetQuota: totalQuota,
    customProbabilities,
  });

  return c.json({ success: true, data: summary });
});

forecastingApp.post("/stage-mappings", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { stage, forecastCategory } = body;

  if (!stage || !forecastCategory) {
    return c.json({ error: "Missing required mapping fields" }, 400);
  }

  const validCategories = [
    "Omitted",
    "Pipeline",
    "Best Case",
    "Commit",
    "Closed",
  ];
  if (!validCategories.includes(forecastCategory)) {
    return c.json(
      {
        error:
          "Invalid forecastCategory. Must be one of: Omitted, Pipeline, Best Case, Commit, Closed",
      },
      400,
    );
  }

  const mapping = await dbStore.stageForecastMappings.upsert({
    orgId: tenant.orgId,
    stage,
    forecastCategory,
  });

  return c.json({ success: true, data: mapping });
});

forecastingApp.get("/stage-mappings", tenantAuth, async (c) => {
  const mappings = await dbStore.stageForecastMappings.findMany();
  return c.json({ success: true, data: mappings });
});

forecastingApp.get("/categories-summary", tenantAuth, async (c) => {
  const periodParam = c.req.query("period"); // e.g. ?period=2026-05

  const opportunities = await dbStore.opportunities.findMany();
  const dbProbs = await dbStore.stageProbabilities.findMany();
  const dbMappings = await dbStore.stageForecastMappings.findMany();

  const customProbabilities: Record<string, number> = {};
  for (const p of dbProbs) {
    customProbabilities[p.stage] = p.probability;
  }

  const stageMappings: Record<string, string> = {};
  for (const m of dbMappings) {
    stageMappings[m.stage] = m.forecastCategory;
  }

  const oppInputs = opportunities.map((opp) => ({
    id: opp.id,
    stage: opp.stage,
    amount: opp.amount,
    closeDate: opp.closeDate,
  }));

  let filteredOpps = oppInputs;
  if (periodParam) {
    filteredOpps = oppInputs.filter((opp) => {
      if (!opp.closeDate) return false;
      try {
        const d = new Date(opp.closeDate);
        return (
          !Number.isNaN(d.getTime()) &&
          d.toISOString().substring(0, 7) === periodParam
        );
      } catch (_e) {
        return false;
      }
    });
  }

  const summary = compileForecastCategorySummary({
    opportunities: filteredOpps,
    stageMappings,
    customProbabilities,
  });

  return c.json({ success: true, data: summary });
});
