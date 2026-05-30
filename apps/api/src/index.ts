// MUST be the first import: initializes OTel + auto-instrumentations
// before any module they patch (http, pg, etc.) is required.
import { createLogger, initOtel } from "@crm/observability";

initOtel({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "crm-api",
  serviceVersion: "0.1.0",
});

const log = createLogger({ name: "api.bootstrap" });

import {
  createSessionToken,
  type TenantContext,
  verifySessionToken,
} from "@crm/auth";
import {
  applyTicketMacro,
  archiveMarketingSequence,
  calculateAccountDuplicates,
  calculateAdjustedForecast,
  calculateAgentCSATMetrics,
  calculateBounceAnalytics,
  calculateCampaignRevenueShare,
  calculateCampaignROI,
  calculateCampaignStats,
  calculateContactDuplicates,
  calculateCPQPrice,
  calculateGlobalCompetitorAnalytics,
  calculateLeadDuplicates,
  calculateLeadScore,
  calculateLinkEngagementAnalytics,
  calculateMilestoneDueDate,
  calculateNextRunDate,
  calculateOpenAnalytics,
  calculateOpportunityCommission,
  calculateOpportunitySplits,
  calculateProRatedAmount,
  calculateReadTimeAnalytics,
  calculateRecipientEngagementScore,
  calculateReplyAnalytics,
  calculateSalesLeaderboard,
  calculateSequenceAnalytics,
  calculateSlaStatus,
  calculateStageVelocity,
  calculateStalledOpportunities,
  calculateSurveyMetrics,
  calculateUnsubscribeAnalytics,
  cloneMarketingSequence,
  compileEmailTemplate,
  compileKanbanPipeline,
  convertCurrency,
  convertLead,
  convertLeadWithMappings,
  deleteMarketingSequenceStep,
  detectCircularAccountRelation,
  detectCircularContactRelation,
  detectFolderLoop,
  enrollInSequence,
  enrollSegmentInSequence,
  evaluateLeadAssignment,
  evaluateLeadAutoConversion,
  evaluateMilestoneCompletion,
  evaluateTerritoryRouting,
  evaluateTicketAssignment,
  evaluateTicketEscalation,
  executePendingSequenceSteps,
  generateRenewalOpportunity,
  generateStraightLineSchedules,
  getMarketingSequenceMemberLogs,
  handleEmailDeliveryEvent,
  incrementArticleViewCount,
  mergeAccounts,
  mergeContacts,
  mergeLeads,
  parseCSV,
  parseUtmParams,
  pauseMarketingSequence,
  processCSVImport,
  processESignatureTransition,
  processSequenceEmailOpen,
  processSequenceEmailReply,
  processSequenceLinkClick,
  processSequenceMembershipScoreTriggers,
  purgeMarketingSequence,
  reorderMarketingSequenceSteps,
  resolveSegmentMembers,
  resumeMarketingSequence,
  rollbackStoreMigrations,
  rollupHierarchyPipeline,
  rollupOpportunityAmount,
  runPendingScheduledReports,
  runStoreMigrations,
  type StageGateRule,
  setPrimaryOpportunityContactRole,
  syncExternalItems,
  validateAccountTeamMember,
  validateArticleStatus,
  validateCSATFeedbackInput,
  validateCustomValidationRules,
  validateEmailLogInput,
  validateHexColor,
  validateInfluencePercentageTotal,
  validateOpportunityApprovalSubmission,
  validateOpportunityProductSchedule,
  validateOpportunityStageGate,
  validateOpportunityTeamMember,
  validatePicklistDependencies,
  validateSurveyResponse,
  validateTicketCommentInput,
  validateTicketMacroInput,
  validateTicketTagInput,
} from "@crm/core";
import {
  type DBCurrency,
  type DBMarketingSequence,
  type DBOpportunityStageGate,
  type DBStageGuidance,
  dbStore,
  genId,
  mockDb,
  store,
  withTenant,
} from "@crm/db";
import { compileTemplate } from "@crm/documents";
import {
  compileForecastCategorySummary,
  compileForecastSummary,
} from "@crm/forecasting";
import { compileFormLayout, validateCustomFields } from "@crm/metadata";
import { createTicket, resolveTicket } from "@crm/module-service-lite";
import { runReport } from "@crm/reporting";
import { globalFuzzySearch } from "@crm/search";
import { enqueueOutboundWebhooks, processOutboxItems } from "@crm/webhooks";
import { executeWorkflows } from "@crm/workflow";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";

import { checkAndRunLeadAutoConversion } from "./lib/leadAutoConversion";
import { mcpTools } from "./lib/mcpTools";
import {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "./lib/validation";
import { triggerOutboundWebhooks } from "./lib/webhooks";
import { type Env, tenantAuth } from "./middleware/tenantAuth";
import { accountsApp } from "./routes/accounts";
import { authApp } from "./routes/auth";
import { campaignsApp, segmentsApp, unsubscribesApp } from "./routes/campaigns";
import { contactsApp } from "./routes/contacts";
import { currenciesApp } from "./routes/currencies";
import { healthApp } from "./routes/health";
import { leadConversionsApp } from "./routes/lead-conversions";
import { leadsApp } from "./routes/leads";
import { mcpApp } from "./routes/mcp";
import { metadataApp } from "./routes/metadata";
import {
  approvalsApp,
  opportunitiesApp,
  pricebooksApp,
  productsApp,
} from "./routes/opportunities";
import { publicApp } from "./routes/public";
import { commissionsApp, quotasApp, territoriesApp } from "./routes/sales-ops";
import { emailsApp, publicEmailsApp, sequencesApp } from "./routes/sequences";
import { serviceApp } from "./routes/service";
import { stageGatesApp, stageGuidanceApp } from "./routes/stages";
import { ticketsApp } from "./routes/tickets";
import { workflowsApp } from "./routes/workflows";

// Re-exports preserve the public surface used by 130 integration test
// files until spec 023 lands the createTestApp harness.
export { checkAndRunLeadAutoConversion } from "./lib/leadAutoConversion";
export { mcpTools } from "./lib/mcpTools";
export {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "./lib/validation";
export { triggerOutboundWebhooks } from "./lib/webhooks";
export { tenantAuth } from "./middleware/tenantAuth";

const app = new Hono<Env>();
app.use("*", cors());

app.route("/health", healthApp);
app.route("/api/auth", authApp);
app.route("/api/public", publicApp);
app.route("/mcp", mcpApp);
app.route("/api/metadata", metadataApp);
app.route("/api/workflows", workflowsApp);
app.route("/api/tickets", ticketsApp);
app.route("/api/service", serviceApp);
app.route("/api/lead-conversions", leadConversionsApp);
app.route("/api/currencies", currenciesApp);
app.route("/api/stage-guidance", stageGuidanceApp);
app.route("/api/stage-gates", stageGatesApp);
app.route("/api/leads", leadsApp);
app.route("/api/accounts", accountsApp);
app.route("/api/contacts", contactsApp);
app.route("/api/opportunities", opportunitiesApp);
app.route("/api/campaigns", campaignsApp);
app.route("/api/segments", segmentsApp);
app.route("/api/unsubscribes", unsubscribesApp);
app.route("/api/products", productsApp);
app.route("/api/pricebooks", pricebooksApp);
app.route("/api/approvals", approvalsApp);
app.route("/api/sequences", sequencesApp);
app.route("/api/emails", emailsApp);
app.route("/api/public/emails", publicEmailsApp);
app.route("/api/territories", territoriesApp);
app.route("/api/commissions", commissionsApp);
app.route("/api/quotas", quotasApp);

app.get("/api/reports/stage-velocity", tenantAuth, async (c) => {
  const history = await dbStore.opportunityStageHistory.findMany();
  const historyInputs = history.map((h) => ({
    opportunityId: h.opportunityId,
    fromStage: h.fromStage,
    toStage: h.toStage,
    createdAt: h.createdAt,
  }));
  const velocityReport = calculateStageVelocity(historyInputs, new Date());
  return c.json({ success: true, data: velocityReport });
});

app.get("/api/reports/competitor-analytics", tenantAuth, async (c) => {
  const competitors = await dbStore.opportunityCompetitors.findMany();
  const opportunities = await dbStore.opportunities.findMany();

  const report = calculateGlobalCompetitorAnalytics({
    competitors: competitors.map((comp) => ({
      id: comp.id,
      orgId: comp.orgId,
      opportunityId: comp.opportunityId,
      name: comp.name,
      strength: comp.strength,
      weakness: comp.weakness,
      winLossStatus: comp.winLossStatus,
    })),
    opportunities: opportunities.map((opp) => ({
      id: opp.id,
      orgId: opp.orgId,
      stage: opp.stage,
      amount: opp.amount,
    })),
  });

  return c.json({ success: true, data: report });
});

// Activities & Chronological Task Timelines REST API Endpoints
app.post("/api/activities", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { type, subject, body: noteBody, dueDate, links } = body;

  if (!type || !subject) {
    return c.json({ error: "Missing required activity parameters" }, 400);
  }

  const allowedTypes = ["task", "call", "note", "email"];
  if (!allowedTypes.includes(type)) {
    return c.json(
      { error: `Invalid activity type. Allowed: ${allowedTypes.join(", ")}` },
      400,
    );
  }

  const activity = await dbStore.activities.insert({
    orgId: tenant.orgId,
    creatorId: tenant.userId,
    type,
    subject,
    body: noteBody !== undefined ? noteBody : null,
    dueDate: dueDate ? new Date(dueDate) : null,
  });

  const insertedLinks = [];
  if (links && Array.isArray(links)) {
    const allowedTargetTypes = ["Account", "Contact", "Lead", "Opportunity"];
    for (const link of links) {
      const { targetType, targetId } = link;
      if (targetType && targetId && allowedTargetTypes.includes(targetType)) {
        const linkRecord = await dbStore.activityLinks.insert({
          orgId: tenant.orgId,
          activityId: activity.id,
          targetType,
          targetId,
        });
        insertedLinks.push(linkRecord);
      }
    }
  }

  return c.json({
    success: true,
    data: {
      ...activity,
      links: insertedLinks,
    },
  });
});

app.get("/api/activities/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const activity = await dbStore.activities.findOne(id);
  if (!activity) {
    return c.json({ error: "Activity not found" }, 404);
  }
  return c.json({ success: true, data: activity });
});

app.get(
  "/api/activities/timeline/:targetType/:targetId",
  tenantAuth,
  async (c) => {
    const targetType = c.req.param("targetType");
    const targetId = c.req.param("targetId");

    const allowedTargetTypes = ["Account", "Contact", "Lead", "Opportunity"];
    if (!allowedTargetTypes.includes(targetType)) {
      return c.json(
        {
          error: `Invalid target type. Allowed: ${allowedTargetTypes.join(", ")}`,
        },
        400,
      );
    }

    const allLinks = await dbStore.activityLinks.findMany();
    const matchedLinks = allLinks.filter(
      (l) => l.targetType === targetType && l.targetId === targetId,
    );

    const matchedActivityIds = new Set(matchedLinks.map((l) => l.activityId));
    const activities = await dbStore.activities.findMany();
    const filteredActivities = activities.filter((act) =>
      matchedActivityIds.has(act.id),
    );

    filteredActivities.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return c.json({ success: true, data: filteredActivities });
  },
);

// Analytical Reporting & Saved Views REST API Endpoints
app.post("/api/reports", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, objectType, groupBy, aggregateField, aggregateFunc } = body;

  if (!name || !objectType || !groupBy) {
    return c.json({ error: "Missing required report fields" }, 400);
  }

  const allowedObjectTypes = [
    "leads",
    "opportunities",
    "tickets",
    "accounts",
    "contacts",
  ];
  if (!allowedObjectTypes.includes(objectType)) {
    return c.json(
      {
        error: `Invalid object type. Allowed: ${allowedObjectTypes.join(", ")}`,
      },
      400,
    );
  }

  const allowedFuncs = ["count", "sum", "avg"];
  const func = aggregateFunc || "count";
  if (!allowedFuncs.includes(func)) {
    return c.json(
      {
        error: `Invalid aggregate function. Allowed: ${allowedFuncs.join(", ")}`,
      },
      400,
    );
  }

  const newReport = await dbStore.reports.insert({
    orgId: tenant.orgId,
    name,
    objectType: objectType as
      | "leads"
      | "opportunities"
      | "tickets"
      | "accounts"
      | "contacts",
    groupBy,
    aggregateField: aggregateField || null,
    aggregateFunc: func as "count" | "sum" | "avg",
  });

  return c.json({ success: true, data: newReport });
});

app.get("/api/reports", tenantAuth, async (c) => {
  const reports = await dbStore.reports.findMany();
  return c.json({ success: true, data: reports });
});

app.post("/api/reports/run", tenantAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, objectType, groupBy, aggregateField, aggregateFunc } = body;

  if (!objectType || !groupBy) {
    return c.json({ error: "Missing required report execution fields" }, 400);
  }

  const allowedObjectTypes = [
    "leads",
    "opportunities",
    "tickets",
    "accounts",
    "contacts",
  ];
  if (!allowedObjectTypes.includes(objectType)) {
    return c.json(
      {
        error: `Invalid object type. Allowed: ${allowedObjectTypes.join(", ")}`,
      },
      400,
    );
  }

  const allowedFuncs = ["count", "sum", "avg"];
  const func = aggregateFunc || "count";
  if (!allowedFuncs.includes(func)) {
    return c.json(
      {
        error: `Invalid aggregate function. Allowed: ${allowedFuncs.join(", ")}`,
      },
      400,
    );
  }

  let records: Record<string, unknown>[] = [];
  if (objectType === "leads")
    records = (await dbStore.leads.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (objectType === "opportunities")
    records = (await dbStore.opportunities.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (objectType === "tickets")
    records = (await dbStore.tickets.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (objectType === "accounts")
    records = (await dbStore.accounts.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (objectType === "contacts")
    records = (await dbStore.contacts.findMany()) as unknown as Record<
      string,
      unknown
    >[];

  const results = runReport({
    name: name || "Ad-hoc Report",
    records,
    groupBy,
    aggregateField: aggregateField || null,
    aggregateFunc: func as "count" | "sum" | "avg",
  });

  return c.json({ success: true, data: results });
});

app.get("/api/reports/:id/run", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const report = await dbStore.reports.findOne(id);
  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }

  let records: Record<string, unknown>[] = [];
  if (report.objectType === "leads")
    records = (await dbStore.leads.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (report.objectType === "opportunities")
    records = (await dbStore.opportunities.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (report.objectType === "tickets")
    records = (await dbStore.tickets.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (report.objectType === "accounts")
    records = (await dbStore.accounts.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (report.objectType === "contacts")
    records = (await dbStore.contacts.findMany()) as unknown as Record<
      string,
      unknown
    >[];

  const results = runReport({
    name: report.name,
    records,
    groupBy: report.groupBy,
    aggregateField: report.aggregateField,
    aggregateFunc: report.aggregateFunc,
  });

  return c.json({ success: true, data: results });
});

// Product Catalog REST API Routes

// Pricebook Catalog REST API Routes

// Opportunity Line Items REST API Routes with Automatic Amount Rollup

// Quota Configuration REST API Route

// Custom Stage Probabilities Configuration REST API Route
app.post("/api/forecasting/probabilities", tenantAuth, async (c) => {
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

app.get("/api/forecasting/probabilities", tenantAuth, async (c) => {
  const probs = await dbStore.stageProbabilities.findMany();
  return c.json({ success: true, data: probs });
});

// Forecast Summary Aggregate REST API Route
app.get("/api/forecasting/summary", tenantAuth, async (c) => {
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

// Stage-to-Forecast-Category Mapping Configuration REST API Routes
app.post("/api/forecasting/stage-mappings", tenantAuth, async (c) => {
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

app.get("/api/forecasting/stage-mappings", tenantAuth, async (c) => {
  const mappings = await dbStore.stageForecastMappings.findMany();
  return c.json({ success: true, data: mappings });
});

// Category-Based Forecast Summary REST API Route
app.get("/api/forecasting/categories-summary", tenantAuth, async (c) => {
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

// Outbound Webhooks REST API Routes
app.post("/api/webhooks", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { targetUrl, secret } = body;

  if (!targetUrl) {
    return c.json(
      { error: "Missing required webhook targetUrl parameter" },
      400,
    );
  }

  const webhook = await dbStore.webhooks.insert({
    orgId: tenant.orgId,
    targetUrl,
    secret: secret || null,
    status: "active",
  });

  return c.json({ success: true, data: webhook });
});

app.get("/api/webhooks", tenantAuth, async (c) => {
  const webhooks = await dbStore.webhooks.findMany();
  return c.json({ success: true, data: webhooks });
});

app.get("/api/webhooks/deliveries", tenantAuth, async (c) => {
  const deliveries = await dbStore.webhookDeliveries.findMany();
  return c.json({ success: true, data: deliveries });
});

app.get("/api/webhooks/outbox", tenantAuth, async (c) => {
  const outbox = await dbStore.webhookOutbox.findMany();
  return c.json({ success: true, data: outbox });
});

app.get("/api/webhooks/dlq", tenantAuth, async (c) => {
  const dlq = await dbStore.webhookDlq.findMany();
  return c.json({ success: true, data: dlq });
});

app.post("/api/webhooks/process-outbox", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const result = await processOutboxItems(tenant.orgId, dbStore);
  return c.json({ success: true, ...result });
});

// Document Templates Configuration REST API Routes
app.post("/api/documents/templates", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, content } = body;

  if (!name || !content) {
    return c.json({ error: "Missing required document template fields" }, 400);
  }

  const template = await dbStore.documentTemplates.insert({
    orgId: tenant.orgId,
    name,
    content,
  });

  return c.json({ success: true, data: template });
});

app.get("/api/documents/templates", tenantAuth, async (c) => {
  const templates = await dbStore.documentTemplates.findMany();
  return c.json({ success: true, data: templates });
});

// Mail Merge Compiler Execution Route
app.post("/api/documents/merge", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { templateId, recordType, recordId } = body;

  if (!templateId || !recordType || !recordId) {
    return c.json({ error: "Missing required merge parameters" }, 400);
  }

  const template = await dbStore.documentTemplates.findOne(templateId);
  if (!template) {
    return c.json({ error: "Document template not found" }, 404);
  }

  let record: Record<string, unknown> | null = null;
  if (recordType === "Lead") {
    const lead = await dbStore.leads.findOne(recordId);
    if (lead) {
      const emailParts = lead.email
        ? lead.email.split("@")[0].split(".")
        : ["Unknown"];
      const firstName = emailParts[0] || "Unknown";
      const lastName = emailParts[1] || "Contact";
      record = {
        ...(lead as unknown as Record<string, unknown>),
        firstName,
        lastName,
      };
    }
  } else if (recordType === "Account") {
    record = (await dbStore.accounts.findOne(recordId)) as unknown as Record<
      string,
      unknown
    >;
  } else if (recordType === "Contact") {
    record = (await dbStore.contacts.findOne(recordId)) as unknown as Record<
      string,
      unknown
    >;
  } else if (recordType === "Opportunity") {
    record = (await dbStore.opportunities.findOne(
      recordId,
    )) as unknown as Record<string, unknown>;
  } else if (recordType === "Ticket") {
    record = (await dbStore.tickets.findOne(recordId)) as unknown as Record<
      string,
      unknown
    >;
  }

  if (!record) {
    return c.json(
      { error: `Target record ${recordType} with ID ${recordId} not found` },
      404,
    );
  }

  const compiledContent = compileTemplate(template.content, record);

  const merged = await dbStore.mergedDocuments.insert({
    orgId: tenant.orgId,
    templateId,
    recordType,
    recordId,
    compiledContent,
  });

  return c.json({ success: true, data: merged });
});

app.get("/api/documents/merged", tenantAuth, async (c) => {
  const merged = await dbStore.mergedDocuments.findMany();
  return c.json({ success: true, data: merged });
});

// Subscription Management Endpoints
app.post("/api/subscriptions", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    accountId,
    planName,
    billingPeriod,
    unitPrice,
    quantity,
    startDate,
    endDate,
  } = body;

  if (!accountId || !planName || !billingPeriod || !unitPrice || !startDate) {
    return c.json({ error: "Missing required subscription parameters" }, 400);
  }

  const sub = await dbStore.subscriptions.insert({
    orgId: tenant.orgId,
    accountId,
    planName,
    status: "active",
    billingPeriod,
    unitPrice: String(unitPrice),
    quantity: quantity !== undefined ? Number(quantity) : 1,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: sub.id,
    recordType: "Subscription",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  triggerOutboundWebhooks(
    tenant.orgId,
    "subscription.created",
    sub as unknown as Record<string, unknown>,
  );

  return c.json({ success: true, data: sub });
});

app.get("/api/subscriptions", tenantAuth, async (c) => {
  const subs = await dbStore.subscriptions.findMany();
  return c.json({ success: true, data: subs });
});

// Invoice Generation Endpoints
app.post("/api/invoices/generate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { dueDate, daysUsed, daysInPeriod } = body;

  const subs = await dbStore.subscriptions.findMany();
  const activeSubs = subs.filter((s) => s.status === "active");

  const generatedInvoices = [];
  for (const sub of activeSubs) {
    const existingInvoices = await dbStore.invoices.findMany();
    const alreadyInvoiced = existingInvoices.some(
      (inv) =>
        inv.subscriptionId === sub.id &&
        (dueDate
          ? new Date(inv.dueDate).getTime() === new Date(dueDate).getTime()
          : true),
    );
    if (alreadyInvoiced && !body.force) {
      continue;
    }

    let amount = String(Number.parseFloat(sub.unitPrice) * sub.quantity);
    if (daysUsed !== undefined && daysInPeriod !== undefined) {
      amount = calculateProRatedAmount({
        unitPrice: sub.unitPrice,
        quantity: sub.quantity,
        daysUsed,
        daysInPeriod,
      });
    }

    const inv = await dbStore.invoices.insert({
      orgId: tenant.orgId,
      subscriptionId: sub.id,
      accountId: sub.accountId,
      amount,
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      status: "Unpaid",
    });
    generatedInvoices.push(inv);

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: inv.id,
      recordType: "Invoice",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });

    triggerOutboundWebhooks(
      tenant.orgId,
      "invoice.created",
      inv as unknown as Record<string, unknown>,
    );
  }

  return c.json({ success: true, data: generatedInvoices });
});

app.get("/api/invoices", tenantAuth, async (c) => {
  const invs = await dbStore.invoices.findMany();
  return c.json({ success: true, data: invs });
});

// Configure-Price-Quote (CPQ) Generation Endpoints

// Outbound Email Logging Endpoints

// Global Multi-Field Fuzzy Trigram Search Endpoint
app.get("/api/search", tenantAuth, async (c) => {
  const q = c.req.query("q") || "";
  const typesParam = c.req.query("types");
  const thresholdParam = c.req.query("threshold");

  const types = typesParam
    ? (typesParam.split(",") as (
        | "Lead"
        | "Account"
        | "Contact"
        | "Opportunity"
      )[])
    : undefined;

  const threshold = thresholdParam
    ? Number.parseFloat(thresholdParam)
    : undefined;

  const results = await globalFuzzySearch(q, {
    types,
    threshold,
    dbStore,
  });

  return c.json({ success: true, data: results });
});

// Global Multi-Field Fuzzy Trigram Search Endpoint (Fuzzy Alias)
app.get("/api/search/fuzzy", tenantAuth, async (c) => {
  const q = c.req.query("q") || "";
  const typesParam = c.req.query("types");
  const thresholdParam = c.req.query("threshold");

  const types = typesParam
    ? (typesParam.split(",") as (
        | "Lead"
        | "Account"
        | "Contact"
        | "Opportunity"
      )[])
    : undefined;

  const threshold = thresholdParam
    ? Number.parseFloat(thresholdParam)
    : undefined;

  const results = await globalFuzzySearch(q, {
    types,
    threshold,
    dbStore,
  });

  return c.json({ success: true, data: results });
});

// Opportunity Approval Endpoints

// Lead Assignment Rules & Auto-Routing Endpoints
app.post("/api/lead-assignment-rules", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, isActive, entries } = body;

  if (!name) {
    return c.json({ error: "Missing required rule parameter: name" }, 400);
  }

  if (isActive === 1) {
    const existingRules = await dbStore.leadAssignmentRules.findMany();
    for (const rule of existingRules) {
      if (rule.isActive === 1) {
        await dbStore.leadAssignmentRules.update(rule.id, { isActive: 0 });
      }
    }
  }

  const newRule = await dbStore.leadAssignmentRules.insert({
    orgId: tenant.orgId,
    name,
    isActive: isActive !== undefined ? Number(isActive) : 0,
  });

  const createdEntries = [];
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      const { sortOrder, routingMethod, routingUserIds, criteria } = entry;
      if (
        sortOrder !== undefined &&
        routingMethod &&
        Array.isArray(routingUserIds) &&
        Array.isArray(criteria)
      ) {
        const newEntry = await dbStore.leadAssignmentRuleEntries.insert({
          orgId: tenant.orgId,
          ruleId: newRule.id,
          sortOrder: Number(sortOrder),
          routingMethod,
          routingUserIds,
          lastAssignedIndex: -1,
          criteria,
        });
        createdEntries.push(newEntry);
      }
    }
  }

  return c.json({
    success: true,
    data: { ...newRule, entries: createdEntries },
  });
});

app.get("/api/lead-assignment-rules", tenantAuth, async (c) => {
  const rules = await dbStore.leadAssignmentRules.findMany();
  const allEntries = await dbStore.leadAssignmentRuleEntries.findMany();

  const data = rules.map((r) => {
    const entries = allEntries
      .filter((e) => e.ruleId === r.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { ...r, entries };
  });

  return c.json({ success: true, data });
});

app.post("/api/leads/:id/assign", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }

  const rules = await dbStore.leadAssignmentRules.findMany();
  const activeRule = rules.find((r) => r.isActive === 1);
  if (!activeRule) {
    return c.json({
      success: false,
      message: "No active assignment rule found.",
    });
  }

  const allEntries = await dbStore.leadAssignmentRuleEntries.findMany();
  const activeEntries = allEntries
    .filter((e) => e.ruleId === activeRule.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (activeEntries.length === 0) {
    return c.json({
      success: false,
      message: "Active assignment rule has no entries.",
    });
  }

  const evalLead = {
    ...lead,
    custom: lead.custom || null,
  };
  const matchResult = evaluateLeadAssignment(evalLead, activeEntries);

  if (!matchResult) {
    return c.json({
      success: false,
      message: "No matching routing entry found for this lead.",
    });
  }

  const previousOwnerId = lead.ownerId;
  const updatedLead = await dbStore.leads.update(id, {
    ownerId: matchResult.newOwnerId,
  });

  const matchedEntry = activeEntries.find(
    (e) => e.id === matchResult.matchedEntryId,
  );
  if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
    await dbStore.leadAssignmentRuleEntries.update(matchedEntry.id, {
      lastAssignedIndex: matchResult.newLastAssignedIndex,
    });
  }

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "leads",
    action: "assign",
    userId: tenant.userId,
    changes: {
      ownerId: { before: previousOwnerId, after: matchResult.newOwnerId },
    },
  });

  return c.json({
    success: true,
    data: updatedLead,
    matchInfo: {
      ruleId: activeRule.id,
      entryId: matchResult.matchedEntryId,
      newOwnerId: matchResult.newOwnerId,
    },
  });
});

// Territories Management REST API Endpoints

app.post("/api/accounts/:id/route", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const territories = await dbStore.territories.findMany();
  const members = await dbStore.territoryMembers.findMany();

  const evalAccount = {
    ...account,
    custom: account.custom || null,
  };

  const matchResult = evaluateTerritoryRouting(
    evalAccount,
    territories,
    members,
  );

  if (!matchResult) {
    return c.json({
      success: false,
      message: "No matching territory routing found.",
    });
  }

  const matchedTerritory = territories.find(
    (t) => t.id === matchResult.matchedTerritoryId,
  );

  const previousOwnerId = account.ownerId;
  let updatedAccount = account;

  if (matchResult.newOwnerId) {
    const existingCustom =
      (account.custom as Record<string, unknown> | null) || {};
    const updatedCustom = {
      ...existingCustom,
      territoryId: matchResult.matchedTerritoryId,
      territoryName: matchedTerritory?.name || "Unknown",
    };

    const updated = await dbStore.accounts.update(id, {
      ownerId: matchResult.newOwnerId,
      custom: updatedCustom,
    });
    if (updated) {
      updatedAccount = updated;
    }
  }

  // Update territory round-robin index if needed
  if (matchedTerritory && matchedTerritory.routingMethod === "round_robin") {
    await dbStore.territories.update(matchedTerritory.id, {
      lastAssignedIndex: matchResult.newLastAssignedIndex,
    });
  }

  // Log audit logs
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "accounts",
    action: "route",
    userId: tenant.userId,
    changes: {
      ownerId: { before: previousOwnerId, after: matchResult.newOwnerId },
      territoryId: { before: null, after: matchResult.matchedTerritoryId },
    },
  });

  // Trigger Webhook
  triggerOutboundWebhooks(tenant.orgId, "account.routed", {
    accountId: id,
    territoryId: matchResult.matchedTerritoryId,
    newOwnerId: matchResult.newOwnerId,
  });

  return c.json({
    success: true,
    data: updatedAccount,
    matchInfo: {
      territoryId: matchResult.matchedTerritoryId,
      newOwnerId: matchResult.newOwnerId,
    },
  });
});

// Campaigns & Campaign Members Endpoints

app.post("/api/public/campaigns/:id/track-utm", async (c) => {
  const campaignId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { utmSource, utmMedium, utmCampaign, leadId, contactId } = body;

  // biome-ignore lint/suspicious/noExplicitAny: findOnePublic bypasses active tenant RLS for public analytics ingest
  const campaign = await (dbStore.campaigns as any).findOnePublic(campaignId);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const orgId = campaign.orgId;

  await withTenant(orgId, mockDb, async () => {
    // 1. Record CRM activity of type 'task' indicating campaign click
    if (dbStore.activities) {
      await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject: `UTM Campaign Link Click: ${utmCampaign || "none"}`,
        body: `UTM Engagement Details:\nSource: ${utmSource || "none"}\nMedium: ${utmMedium || "none"}\nCampaign: ${utmCampaign || "none"}`,
        dueDate: null,
        custom: { utmSource, utmMedium, utmCampaign },
      });
    }

    // 2. Upsert Campaign Member status to 'Responded' if leadId or contactId is provided
    if (dbStore.campaignMembers && (leadId || contactId)) {
      const existingMembers =
        await dbStore.campaignMembers.findForCampaign(campaignId);
      const member = existingMembers.find(
        (m) =>
          (leadId && m.leadId === leadId) ||
          (contactId && m.contactId === contactId),
      );

      if (member) {
        await dbStore.campaignMembers.update(member.id, {
          status: "Responded",
        });
      } else {
        await dbStore.campaignMembers.insert({
          orgId,
          campaignId,
          leadId: leadId || null,
          contactId: contactId || null,
          status: "Responded",
        });
      }
    }
  });

  return c.json({ success: true });
});

// Campaign Influence Endpoints

// Contract Management Endpoints
app.get("/api/accounts/:id/contracts", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  const contracts = await dbStore.contracts.findForAccount(id);
  return c.json({ success: true, data: contracts });
});

app.post("/api/contracts", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    accountId,
    opportunityId,
    contractAmount,
    startDate,
    endDate,
    status,
  } = body;

  if (!accountId || !contractAmount || !startDate || !endDate) {
    return c.json(
      {
        error: "accountId, contractAmount, startDate, and endDate are required",
      },
      400,
    );
  }

  const account = await dbStore.accounts.findOne(accountId);
  if (!account) {
    return c.json({ error: "Account not found" }, 400);
  }

  const newContract = await dbStore.contracts.insert({
    orgId: tenant.orgId,
    accountId,
    opportunityId: opportunityId || null,
    contractAmount: String(contractAmount),
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    status: status || "Draft",
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newContract.id,
    recordType: "contracts",
    action: "create",
    userId: tenant.userId,
    changes: {
      contract: { before: null, after: newContract },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "contract.created",
    newContract as unknown as Record<string, unknown>,
  );

  return c.json({ success: true, data: newContract }, 201);
});

app.patch("/api/contracts/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const currentContract = await dbStore.contracts.findOne(id);
  if (!currentContract) {
    return c.json({ error: "Contract not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const updates: Partial<
    Omit<typeof currentContract, "id" | "orgId" | "createdAt">
  > = {};

  if (body.contractAmount !== undefined)
    updates.contractAmount = String(body.contractAmount);
  if (body.startDate !== undefined)
    updates.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) updates.endDate = new Date(body.endDate);
  if (body.status !== undefined) updates.status = body.status;
  if (body.opportunityId !== undefined)
    updates.opportunityId = body.opportunityId;

  const updatedContract = await dbStore.contracts.update(id, updates);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "contracts",
    action: "update",
    userId: tenant.userId,
    changes: {
      contract: { before: currentContract, after: updatedContract },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "contract.updated",
    updatedContract as unknown as Record<string, unknown>,
  );

  return c.json({ success: true, data: updatedContract });
});

app.delete("/api/contracts/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const currentContract = await dbStore.contracts.findOne(id);
  if (!currentContract) {
    return c.json({ error: "Contract not found" }, 404);
  }

  await dbStore.contracts.delete(id);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "contracts",
    action: "delete",
    userId: tenant.userId,
    changes: {
      contract: { before: currentContract, after: null },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "contract.deleted", {
    orgId: tenant.orgId,
    id,
    accountId: currentContract.accountId,
  });

  return c.json({ success: true });
});

app.post("/api/contracts/:id/renew", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const contract = await dbStore.contracts.findOne(id);
  if (!contract) {
    return c.json({ error: "Contract not found" }, 404);
  }

  if (contract.status !== "Active") {
    return c.json({ error: "Contract must be Active to renew" }, 400);
  }

  const account = await dbStore.accounts.findOne(contract.accountId);
  if (!account) {
    return c.json({ error: "Account associated with contract not found" }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const escalationPct =
    body.escalationPercentage !== undefined
      ? Number(body.escalationPercentage)
      : 5;

  const generatedOpp = generateRenewalOpportunity({
    contract: {
      ...contract,
      contractAmount: contract.contractAmount,
    },
    accountName: account.name,
    escalationPercentage: escalationPct,
  });

  // Create the new renewal opportunity
  const newOpportunity = await dbStore.opportunities.insert({
    orgId: tenant.orgId,
    ownerId: account.ownerId,
    accountId: contract.accountId,
    name: generatedOpp.name,
    stage: generatedOpp.stage,
    amount: generatedOpp.amount,
    closeDate: generatedOpp.closeDate,
    custom: null,
  });

  // Transition contract to "Renewed" and associate the new opportunity
  const updatedContract = await dbStore.contracts.update(id, {
    status: "Renewed",
    opportunityId: newOpportunity.id,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "contracts",
    action: "renew",
    userId: tenant.userId,
    changes: {
      contract: { before: contract, after: updatedContract },
      opportunity: { before: null, after: newOpportunity },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "contract.renewed", {
    contract: updatedContract,
    opportunity: newOpportunity,
  });

  return c.json({ success: true, data: newOpportunity }, 201);
});

app.get("/api/lead-scoring-rules", tenantAuth, async (c) => {
  const rules = await dbStore.leadScoringRules.findMany();
  return c.json({ data: rules });
});

app.post("/api/lead-scoring-rules", tenantAuth, async (c) => {
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

app.get("/api/leads/:id/score", tenantAuth, async (c) => {
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

app.post("/api/leads/:id/score/recalculate", tenantAuth, async (c) => {
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

// Opportunity Product Schedules (Revenue / Quantity Scheduling) Endpoints

app.get("/api/consent", tenantAuth, async (c) => {
  const _tenant = c.get("tenant");
  const recordType = c.req.query("recordType") as
    | "lead"
    | "contact"
    | undefined;
  const recordId = c.req.query("recordId");

  if (!recordType || !["lead", "contact"].includes(recordType)) {
    return c.json(
      {
        error: "Invalid or missing 'recordType' (must be 'lead' or 'contact')",
      },
      400,
    );
  }
  if (!recordId) {
    return c.json({ error: "Missing 'recordId' parameter" }, 400);
  }

  // Verify record exists in active tenant context
  if (recordType === "lead") {
    const lead = await dbStore.leads.findOne(recordId);
    if (!lead) return c.json({ error: "Lead not found" }, 404);
  } else {
    const contact = await dbStore.contacts.findOne(recordId);
    if (!contact) return c.json({ error: "Contact not found" }, 404);
  }

  const results = await dbStore.contactConsentPreferences.findMany(
    recordType,
    recordId,
  );
  return c.json({ success: true, data: results });
});

app.post("/api/consent", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));

  const recordType = body.recordType;
  const recordId = body.recordId;
  const channel = body.channel;
  const status = body.status;
  const source = body.source;

  if (!recordType || !["lead", "contact"].includes(recordType)) {
    return c.json(
      { error: "Invalid 'recordType' (must be 'lead' or 'contact')" },
      400,
    );
  }
  if (!recordId) {
    return c.json({ error: "Missing 'recordId'" }, 400);
  }
  if (!channel || !["email", "sms", "phone"].includes(channel)) {
    return c.json(
      { error: "Invalid 'channel' (must be 'email', 'sms', or 'phone')" },
      400,
    );
  }
  if (!status || !["opt_in", "opt_out", "pending"].includes(status)) {
    return c.json(
      { error: "Invalid 'status' (must be 'opt_in', 'opt_out', or 'pending')" },
      400,
    );
  }
  if (!source || typeof source !== "string" || source.trim() === "") {
    return c.json({ error: "Missing or invalid 'source'" }, 400);
  }

  // Verify record exists in active tenant context
  if (recordType === "lead") {
    const lead = await dbStore.leads.findOne(recordId);
    if (!lead) return c.json({ error: "Lead not found" }, 404);
  } else {
    const contact = await dbStore.contacts.findOne(recordId);
    if (!contact) return c.json({ error: "Contact not found" }, 404);
  }

  const upserted = await dbStore.contactConsentPreferences.upsert({
    orgId: tenant.orgId,
    recordType,
    recordId,
    channel,
    status,
    source,
    updatedById: tenant.userId,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: upserted.id,
    recordType: "contact_consent_preferences",
    action: "upsert",
    userId: tenant.userId,
    changes: { consent: { before: null, after: upserted } },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "contact_consent_preference.updated",
    {
      consentId: upserted.id,
      recordType,
      recordId,
      channel,
      status,
    },
  );

  return c.json({ success: true, data: upserted });
});

// Email & Calendar Sync settings & runs
app.get("/api/productivity/sync/settings", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const settings = await dbStore.emailCalendarSyncSettings.findByUser(
    tenant.userId,
  );
  return c.json({ success: true, data: settings });
});

app.post("/api/productivity/sync/settings", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { provider, isActive, syncEmails, syncCalendar } = body;

  if (!provider) {
    return c.json({ error: "Missing 'provider'" }, 400);
  }

  const existing = await dbStore.emailCalendarSyncSettings.findByUser(
    tenant.userId,
  );
  if (existing) {
    const updated = await dbStore.emailCalendarSyncSettings.update(
      existing.id,
      {
        provider,
        isActive:
          isActive !== undefined ? Boolean(isActive) : existing.isActive,
        syncEmails:
          syncEmails !== undefined ? Boolean(syncEmails) : existing.syncEmails,
        syncCalendar:
          syncCalendar !== undefined
            ? Boolean(syncCalendar)
            : existing.syncCalendar,
      },
    );
    return c.json({ success: true, data: updated });
  }

  const inserted = await dbStore.emailCalendarSyncSettings.insert({
    orgId: tenant.orgId,
    userId: tenant.userId,
    provider,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    syncEmails: syncEmails !== undefined ? Boolean(syncEmails) : true,
    syncCalendar: syncCalendar !== undefined ? Boolean(syncCalendar) : true,
    lastSyncedAt: null,
  });

  return c.json({ success: true, data: inserted });
});

app.post("/api/productivity/sync/trigger", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const mockEmails = body.emails || [];
  const mockEvents = body.events || [];

  const settings = await dbStore.emailCalendarSyncSettings.findByUser(
    tenant.userId,
  );
  if (!settings?.isActive) {
    return c.json({ error: "No active sync settings found for user" }, 400);
  }

  const startedAt = new Date();

  // Retrieve leads and contacts under RLS context
  const leads = await dbStore.leads.findMany();
  const contacts = await dbStore.contacts.findMany();

  // Retrieve existing activities and extract their externalIds from custom metadata
  const activities = await dbStore.activities.findMany();
  const existingExternalIds = activities
    .map((a) => (a.custom as Record<string, unknown> | null)?.externalId)
    .filter((id): id is string => typeof id === "string");

  // Call pure sync calculator
  const syncResult = syncExternalItems({
    settings: {
      syncEmails: settings.syncEmails,
      syncCalendar: settings.syncCalendar,
    },
    externalEmails: mockEmails,
    externalCalendarEvents: mockEvents,
    existingLeads: leads.map((l) => ({ id: l.id, email: l.email })),
    existingContacts: contacts.map((co) => ({ id: co.id, email: co.email })),
    existingActivityExternalIds: existingExternalIds,
  });

  let emailsSyncedCount = 0;
  let eventsSyncedCount = 0;

  // Insert synced emails as activities and create activity links
  for (const syncedEmail of syncResult.syncedEmails) {
    const act = await dbStore.activities.insert({
      orgId: tenant.orgId,
      creatorId: tenant.userId,
      type: "email",
      subject: syncedEmail.subject,
      body: syncedEmail.body,
      dueDate: null,
      createdAt: new Date(syncedEmail.receivedAt),
      custom: { externalId: syncedEmail.externalId },
    });

    await dbStore.activityLinks.insert({
      orgId: tenant.orgId,
      activityId: act.id,
      targetType: syncedEmail.targetType,
      targetId: syncedEmail.targetId,
    });
    emailsSyncedCount++;
  }

  // Insert synced calendar events as activities (meetings / tasks) and create links
  for (const syncedEvent of syncResult.syncedEvents) {
    const act = await dbStore.activities.insert({
      orgId: tenant.orgId,
      creatorId: tenant.userId,
      type: "task",
      subject: `Meeting: ${syncedEvent.title}`,
      body: syncedEvent.description,
      dueDate: new Date(syncedEvent.eventDate),
      createdAt: new Date(),
      custom: { externalId: syncedEvent.externalId },
    });

    await dbStore.activityLinks.insert({
      orgId: tenant.orgId,
      activityId: act.id,
      targetType: syncedEvent.targetType,
      targetId: syncedEvent.targetId,
    });
    eventsSyncedCount++;
  }

  const completedAt = new Date();

  // Log sync run in history
  const runLog = await dbStore.emailCalendarSyncRuns.insert({
    orgId: tenant.orgId,
    settingsId: settings.id,
    status: "success",
    emailsSyncedCount,
    eventsSyncedCount,
    errorMessage: null,
    startedAt,
    completedAt,
  });

  // Update lastSyncedAt on settings
  await dbStore.emailCalendarSyncSettings.update(settings.id, {
    lastSyncedAt: completedAt,
  });

  // Log audit logs
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: runLog.id,
    recordType: "email_calendar_sync_runs",
    action: "sync",
    userId: tenant.userId,
    changes: {
      emailsSyncedCount: { before: null, after: emailsSyncedCount },
      eventsSyncedCount: { before: null, after: eventsSyncedCount },
    },
  });

  // Trigger webhooks
  await triggerOutboundWebhooks(tenant.orgId, "productivity.sync_completed", {
    runId: runLog.id,
    emailsSyncedCount,
    eventsSyncedCount,
  });

  return c.json({ success: true, data: runLog });
});

app.get("/api/productivity/sync/runs", tenantAuth, async (c) => {
  const runs = await dbStore.emailCalendarSyncRuns.findMany();
  return c.json({ success: true, data: runs });
});

app.post("/api/sales/esignature/requests", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { documentName, signerEmail, opportunityId, contractId } = body;

  if (!documentName || !signerEmail) {
    return c.json({ error: "Missing 'documentName' or 'signerEmail'" }, 400);
  }

  if (!signerEmail.includes("@")) {
    return c.json({ error: "Invalid signer email" }, 400);
  }

  if (!opportunityId && !contractId) {
    return c.json(
      {
        error:
          "E-Signature request must be linked to an Opportunity or Contract",
      },
      400,
    );
  }

  const newReq = await dbStore.esignatureRequests.insert({
    orgId: tenant.orgId,
    documentName,
    signerEmail,
    status: "sent",
    opportunityId: opportunityId || null,
    contractId: contractId || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newReq.id,
    recordType: "esignature_requests",
    action: "create",
    userId: tenant.userId,
    changes: {
      documentName: { before: null, after: documentName },
      signerEmail: { before: null, after: signerEmail },
      status: { before: null, after: "sent" },
    },
  });

  return c.json({ success: true, data: newReq });
});

app.get("/api/sales/esignature/requests", tenantAuth, async (c) => {
  const requests = await dbStore.esignatureRequests.findMany();
  return c.json({ success: true, data: requests });
});

app.post("/api/sales/esignature/simulate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { requestId, action } = body;

  if (!requestId || !action) {
    return c.json({ error: "Missing 'requestId' or 'action'" }, 400);
  }

  const existing = await dbStore.esignatureRequests.findOne(requestId);
  if (!existing) {
    return c.json({ error: "E-Signature request not found" }, 404);
  }

  try {
    const transitionResult = processESignatureTransition({
      currentStatus: existing.status,
      action: action as "view" | "sign" | "decline",
    });

    const completedAt = transitionResult.isCompleted ? new Date() : null;

    const updated = await dbStore.esignatureRequests.update(requestId, {
      status: transitionResult.nextStatus,
      completedAt,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: existing.id,
      recordType: "esignature_requests",
      action: "simulate_transition",
      userId: tenant.userId,
      changes: {
        status: { before: existing.status, after: transitionResult.nextStatus },
      },
    });

    await triggerOutboundWebhooks(tenant.orgId, "sales.esignature_updated", {
      requestId: existing.id,
      status: transitionResult.nextStatus,
    });

    return c.json({ success: true, data: updated });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

// Surveys & Customer Satisfaction (CSAT/NPS) API routes
app.post("/api/sales/surveys", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, type, status } = body;

  if (!name || !type) {
    return c.json({ error: "Missing required fields: 'name' or 'type'" }, 400);
  }

  if (type !== "csat" && type !== "nps") {
    return c.json(
      { error: "Invalid survey type. Must be 'csat' or 'nps'" },
      400,
    );
  }

  const surveyStatus = status || "draft";
  if (
    surveyStatus !== "draft" &&
    surveyStatus !== "active" &&
    surveyStatus !== "closed"
  ) {
    return c.json(
      {
        error: "Invalid survey status. Must be 'draft', 'active', or 'closed'",
      },
      400,
    );
  }

  const newSurvey = await dbStore.surveys.insert({
    orgId: tenant.orgId,
    name,
    type: type as "csat" | "nps",
    status: surveyStatus as "draft" | "active" | "closed",
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newSurvey.id,
    recordType: "surveys",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: name },
      type: { before: null, after: type },
      status: { before: null, after: surveyStatus },
    },
  });

  return c.json({ success: true, data: newSurvey });
});

app.get("/api/sales/surveys", tenantAuth, async (c) => {
  const surveys = await dbStore.surveys.findMany();
  return c.json({ success: true, data: surveys });
});

app.post("/api/sales/surveys/responses", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { surveyId, contactId, score, comment } = body;

  if (!surveyId || score === undefined) {
    return c.json(
      { error: "Missing required fields: 'surveyId' or 'score'" },
      400,
    );
  }

  const survey = await dbStore.surveys.findOne(surveyId);
  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  if (survey.status !== "active") {
    return c.json(
      { error: "Survey is not active and cannot accept responses" },
      400,
    );
  }

  const validation = validateSurveyResponse(score, survey.type);
  if (!validation.isValid) {
    return c.json({ error: validation.error }, 400);
  }

  const response = await dbStore.surveyResponses.insert({
    orgId: tenant.orgId,
    surveyId,
    contactId: contactId || null,
    score,
    comment: comment || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: response.id,
    recordType: "survey_responses",
    action: "create",
    userId: tenant.userId,
    changes: {
      surveyId: { before: null, after: surveyId },
      score: { before: null, after: score },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "sales.survey_response_created", {
    responseId: response.id,
    surveyId,
    score,
  });

  return c.json({ success: true, data: response });
});

app.get("/api/sales/surveys/:id/metrics", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const survey = await dbStore.surveys.findOne(id);
  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  const responses = await dbStore.surveyResponses.findBySurvey(id);
  const metrics = calculateSurveyMetrics(responses, survey.type);

  return c.json({ success: true, data: metrics });
});

// CSV Import and Column Mapping Engine for Task 0164
app.post("/api/imports/csv", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { entityType, csvContent, mapping, dryRun } = body;

  if (!entityType || !["lead", "contact"].includes(entityType)) {
    return c.json(
      { error: "Invalid or missing entityType (must be 'lead' or 'contact')" },
      400,
    );
  }
  if (!csvContent) {
    return c.json({ error: "Missing csvContent" }, 400);
  }
  if (!mapping || typeof mapping !== "object") {
    return c.json({ error: "Invalid or missing mapping definition" }, 400);
  }

  const parsed = parseCSV(csvContent);
  const { valid, errors } = processCSVImport(entityType, parsed, mapping);

  const totalRows = Math.max(0, parsed.length - 1);
  const invalidRows = errors.length;
  const validRows = Math.max(0, totalRows - invalidRows);

  const importedIds: string[] = [];

  if (!dryRun && valid.length > 0) {
    const orgId = tenant.orgId;
    const ownerId = tenant.userId;

    for (const record of valid) {
      if (entityType === "lead") {
        const lead = await dbStore.leads.insert({
          orgId,
          ownerId,
          status: (record.status as string) || "New",
          email: (record.email as string) || null,
          company: (record.company as string) || null,
          convertedAccountId: null,
          convertedContactId: null,
          custom: null,
        });
        importedIds.push(lead.id);
      } else if (entityType === "contact") {
        const contact = await dbStore.contacts.insert({
          orgId,
          ownerId,
          accountId: null,
          firstName: (record.firstName as string) || "",
          lastName: (record.lastName as string) || "",
          email: (record.email as string) || null,
          custom: null,
        });
        importedIds.push(contact.id);
      }
    }
  }

  return c.json({
    success: true,
    data: {
      totalRows,
      validRows,
      invalidRows,
      errors,
      importedIds: dryRun ? undefined : importedIds,
    },
  });
});

// Admin High Scale Seeder and Security Fuzzing endpoints for Phase 6
app.post("/api/admin/seed", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const accountCount = Math.min(Number(body.accountCount) || 10, 500);
  const contactCount = Math.min(Number(body.contactCount) || 10, 500);
  const leadCount = Math.min(Number(body.leadCount) || 10, 500);
  const opportunityCount = Math.min(Number(body.opportunityCount) || 10, 500);

  const orgId = tenant.orgId;
  const ownerId = tenant.userId;

  const accounts = [];
  const contacts = [];
  const leads = [];
  const opportunities = [];

  for (let i = 0; i < accountCount; i++) {
    const acc = await dbStore.accounts.insert({
      orgId,
      ownerId,
      name: `Scale Account ${i}`,
      domain: `scale-account-${i}.com`,
      custom: null,
    });
    accounts.push(acc);
  }

  for (let i = 0; i < contactCount; i++) {
    const parentAccount = accounts[i % (accounts.length || 1)];
    const con = await dbStore.contacts.insert({
      orgId,
      ownerId,
      accountId: parentAccount ? parentAccount.id : null,
      firstName: `FirstScale${i}`,
      lastName: `LastScale${i}`,
      email: `scale-contact-${i}@domain.com`,
      custom: null,
    });
    contacts.push(con);
  }

  for (let i = 0; i < leadCount; i++) {
    const ld = await dbStore.leads.insert({
      orgId,
      ownerId,
      status: i % 3 === 0 ? "New" : i % 3 === 1 ? "Working" : "Converted",
      email: `scale-lead-${i}@company.com`,
      company: `Scale Lead Company ${i}`,
      convertedAccountId: null,
      convertedContactId: null,
      custom: null,
    });
    leads.push(ld);
  }

  for (let i = 0; i < opportunityCount; i++) {
    const parentAccount = accounts[i % (accounts.length || 1)];
    const opp = await dbStore.opportunities.insert({
      orgId,
      ownerId,
      accountId: parentAccount ? parentAccount.id : null,
      name: `Scale Opportunity ${i}`,
      stage: i % 2 === 0 ? "Qualification" : "Closed Won",
      amount: (1000 + i * 150).toFixed(2),
      closeDate: new Date("2026-12-31"),
      custom: null,
    });
    opportunities.push(opp);
  }

  return c.json({
    success: true,
    message: `Seeded ${accounts.length} accounts, ${contacts.length} contacts, ${leads.length} leads, ${opportunities.length} opportunities successfully under org ${orgId}.`,
    counts: {
      accounts: accounts.length,
      contacts: contacts.length,
      leads: leads.length,
      opportunities: opportunities.length,
    },
  });
});

app.post("/api/admin/fuzz", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const orgId = tenant.orgId;
  const ownerId = tenant.userId;

  const payloads: { company?: string; email?: string; status?: string }[] = [
    {
      company: "A".repeat(5000), // extreme size
      email: "fuzz-oversized@domain.com",
    },
    {
      company: "Lead' OR '1'='1",
      email: "fuzz-sqli@domain.com",
    },
    {
      company: "Lead <script>alert(1)</script>",
      email: "fuzz-html@domain.com",
    },
    {
      email: "broken-lead@domain.com",
    },
    {
      company: "Empty status corp",
      email: "empty-status@domain.com",
      status: "",
    },
  ];

  const failures: { payload: unknown; error: string }[] = [];

  for (const payload of payloads) {
    try {
      await dbStore.leads.insert({
        orgId,
        ownerId,
        status: payload.status || "New",
        email: payload.email ?? null,
        company: payload.company || null,
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
    } catch (err) {
      failures.push({
        payload,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return c.json({
    success: true,
    totalRuns: payloads.length,
    failures,
  });
});

app.get("/api/db/migrations", tenantAuth, async (c) => {
  const migrations = await dbStore.schemaMigrations.findMany();
  return c.json({
    success: true,
    migrations,
  });
});

app.post("/api/db/migrate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const targetVersion =
    body.targetVersion !== undefined ? Number(body.targetVersion) : undefined;

  const result = await runStoreMigrations(
    dbStore,
    store,
    tenant.orgId,
    targetVersion,
  );

  return c.json(result);
});

app.post("/api/db/rollback", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  if (body.targetVersion === undefined) {
    return c.json(
      { success: false, error: "targetVersion is required for rollback." },
      400,
    );
  }
  const targetVersion = Number(body.targetVersion);

  const result = await rollbackStoreMigrations(
    dbStore,
    store,
    tenant.orgId,
    targetVersion,
  );

  return c.json(result);
});

app.get("/api/reports/scheduled", tenantAuth, async (c) => {
  const schedules = await dbStore.scheduledReports.findMany();
  return c.json({
    success: true,
    schedules,
  });
});

app.post("/api/reports/scheduled", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { reportId, recipientEmail, frequency, isActive } = body;

  if (!reportId || !recipientEmail || !frequency) {
    return c.json(
      { error: "Missing required fields: reportId, recipientEmail, frequency" },
      400,
    );
  }

  const report = await dbStore.reports.findOne(reportId);
  if (!report) {
    return c.json({ error: `Report with ID ${reportId} not found.` }, 404);
  }

  const nextRunAt = calculateNextRunDate(new Date(), frequency);

  const schedule = await dbStore.scheduledReports.insert({
    orgId: tenant.orgId,
    reportId,
    recipientEmail,
    frequency,
    nextRunAt,
    isActive: isActive !== undefined ? Number(isActive) : 1,
  });

  return c.json({
    success: true,
    schedule,
  });
});

app.delete("/api/reports/scheduled/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const schedule = await dbStore.scheduledReports.findOne(id);
  if (!schedule) {
    return c.json(
      { error: "Scheduled report not found or unauthorized." },
      404,
    );
  }
  const success = await dbStore.scheduledReports.delete(id);
  if (!success) {
    return c.json(
      { error: "Scheduled report not found or unauthorized." },
      404,
    );
  }
  return c.json({
    success: true,
  });
});

app.post("/api/reports/scheduled/run-pending", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const processed = await runPendingScheduledReports(
    dbStore,
    store,
    tenant.orgId,
    triggerOutboundWebhooks,
  );
  return c.json({
    success: true,
    processed,
  });
});

app.get("/api/metadata/email-templates", tenantAuth, async (c) => {
  const templates = await dbStore.emailTemplates.findMany();
  return c.json({ success: true, data: templates });
});

app.post("/api/metadata/email-templates", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, subject, body: tBody } = body;

  if (!name || !subject || !tBody) {
    return c.json(
      { error: "Missing required fields: name, subject, body" },
      400,
    );
  }

  const template = await dbStore.emailTemplates.insert({
    orgId: tenant.orgId,
    name,
    subject,
    body: tBody,
  });

  return c.json({ success: true, data: template });
});

app.delete("/api/metadata/email-templates/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const template = await dbStore.emailTemplates.findOne(id);
  if (!template) {
    return c.json({ error: "Email template not found or unauthorized." }, 404);
  }
  const success = await dbStore.emailTemplates.delete(id);
  if (!success) {
    return c.json({ error: "Email template not found or unauthorized." }, 404);
  }
  return c.json({ success: true });
});

app.post("/api/metadata/email-templates/:id/compile", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { leadId, contactId, accountId, opportunityId } = body;

  const template = await dbStore.emailTemplates.findOne(id);
  if (!template) {
    return c.json({ error: "Email template not found or unauthorized." }, 404);
  }

  const context: {
    lead?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    opportunity?: Record<string, unknown> | null;
  } = {};

  if (leadId) {
    context.lead = (await dbStore.leads.findOne(leadId)) as Record<
      string,
      unknown
    > | null;
  }
  if (contactId) {
    context.contact = (await dbStore.contacts.findOne(contactId)) as Record<
      string,
      unknown
    > | null;
  }
  if (accountId) {
    context.account = (await dbStore.accounts.findOne(accountId)) as Record<
      string,
      unknown
    > | null;
  }
  if (opportunityId) {
    context.opportunity = (await dbStore.opportunities.findOne(
      opportunityId,
    )) as Record<string, unknown> | null;
  }

  const compiled = compileEmailTemplate(template, context);

  return c.json({
    success: true,
    compiledSubject: compiled.subject,
    compiledBody: compiled.body,
  });
});

app.get("/api/leaderboards", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const periodParam = c.req.query("period");

  let period = periodParam;
  if (!period) {
    const today = new Date();
    period = today.toISOString().substring(0, 7);
  }

  const tenantMemberships = store.memberships.filter(
    (m) => m.orgId === tenant.orgId,
  );
  const usersInput = tenantMemberships.map((m) => {
    const u = store.users.find((user) => user.id === m.userId);
    return {
      userId: m.userId,
      userName: u ? u.email.split("@")[0] : "Unknown Rep",
    };
  });

  const opportunities = await dbStore.opportunities.findMany();
  const quotas = await dbStore.quotas.findMany();

  const oppsInput = opportunities.map((opp) => ({
    id: opp.id,
    ownerId: opp.ownerId,
    stage: opp.stage,
    amount: opp.amount,
    closeDate: opp.closeDate ? new Date(opp.closeDate) : null,
  }));

  const quotasInput = quotas.map((q) => ({
    userId: q.userId,
    period: q.period,
    targetAmount: q.targetAmount,
  }));

  const result = calculateSalesLeaderboard({
    period,
    users: usersInput,
    opportunities: oppsInput,
    quotas: quotasInput,
  });

  return c.json({
    success: true,
    ...result,
  });
});

app.get("/api/forecasts/adjustments", tenantAuth, async (c) => {
  const adjustments = await dbStore.forecastAdjustments.findMany();
  return c.json({ success: true, data: adjustments });
});

app.post("/api/forecasts/adjustments", tenantAuth, async (c) => {
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

app.get("/api/forecasts/adjusted-summary", tenantAuth, async (c) => {
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

// Email open and click tracking endpoints

// Marketing Sequences & Drip Journeys Endpoints

// Marketing Sequence A/B Split Testing Endpoints

// Marketing Sequence Dynamic Branching Endpoints

// Marketing Segments & Dynamic Lists Endpoints

async function recalculateMemberEngagementScore(
  membershipId: string,
): Promise<number> {
  const membership =
    await dbStore.marketingSequenceMemberships.findOne(membershipId);
  if (!membership) return 0;

  const allLinks = await dbStore.activityLinks.findMany();
  const memberLinks = allLinks.filter(
    (l) =>
      l.targetId === membership.recordId &&
      l.targetType.toLowerCase() === membership.recordType.toLowerCase(),
  );

  const activityIds = memberLinks.map((l) => l.activityId);

  const allTrackers = await dbStore.emailTrackers.findMany();
  const memberTrackers = allTrackers.filter(
    (t) => t.activityId && activityIds.includes(t.activityId),
  );

  const trackerIds = memberTrackers.map((t) => t.id);

  const allReadTimeEvents = await dbStore.emailReadTimeEvents.findMany();
  const memberReadTimeEvents = allReadTimeEvents.filter((e) =>
    trackerIds.includes(e.trackerId),
  );

  const allBounceEvents = await dbStore.emailBounceEvents.findMany();
  const memberBounceEvents = allBounceEvents.filter((e) =>
    trackerIds.includes(e.trackerId),
  );

  let openCount = 0;
  let clickCount = 0;
  let replyCount = 0;
  for (const t of memberTrackers) {
    openCount += t.openCount;
    clickCount += t.clickCount;
    replyCount += t.replyCount;
  }

  const isUnsubscribed = membership.status === "unsubscribed";

  const score = calculateRecipientEngagementScore({
    openCount,
    clickCount,
    replyCount,
    readTimeEvents: memberReadTimeEvents.map((e) => ({
      durationMs: e.durationMs,
      readClassification: e.readClassification,
    })),
    bounceEvents: memberBounceEvents.map((e) => ({
      eventType: e.eventType,
      bounceType: e.bounceType,
    })),
    isUnsubscribed,
  });

  await dbStore.marketingSequenceMemberships.update(membershipId, {
    engagementScore: score,
  });

  await processSequenceMembershipScoreTriggers(
    dbStore,
    membership.orgId,
    membershipId,
  );

  return score;
}

async function recalculateEngagementScoreByTrackerToken(
  token: string,
): Promise<void> {
  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (!tracker) return;

  const allLinks = await dbStore.activityLinks.findMany();
  const link = allLinks.find((l) => l.activityId === tracker.activityId);
  if (!link) return;

  const allMemberships = await dbStore.marketingSequenceMemberships.findMany();
  const membership = allMemberships.find(
    (m) =>
      m.recordId === link.targetId &&
      m.recordType.toLowerCase() === link.targetType.toLowerCase(),
  );

  if (membership) {
    await withTenant(membership.orgId, mockDb, async () => {
      await recalculateMemberEngagementScore(membership.id);
    });
  }
}

// Folder & Tag Categorization Endpoints

// Start Hono Node Server if run directly (excluding test execution environment)

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT) || 3001;
  import("@hono/node-server")
    .then(({ serve }) => {
      log.info({ port }, "Hono API server starting");
      serve({
        fetch: app.fetch,
        port,
      });
    })
    .catch((err) => {
      log.error({ err }, "Failed to load @hono/node-server");
    });
}

export default app;
