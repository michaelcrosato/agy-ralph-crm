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
import {
  adminApp,
  dbApp,
  forecastingApp,
  forecastsApp,
  importsApp,
  leaderboardsApp,
  reportsApp,
} from "./routes/admin";
import { authApp } from "./routes/auth";
import { campaignsApp, segmentsApp, unsubscribesApp } from "./routes/campaigns";
import { contactsApp } from "./routes/contacts";
import {
  contractsApp,
  documentsApp,
  invoicesApp,
  subscriptionsApp,
} from "./routes/contracts";
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
import {
  activitiesApp,
  consentApp,
  productivityApp,
  salesApp,
  searchApp,
  webhooksApp,
} from "./routes/productivity";
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
app.route("/api/admin", adminApp);
app.route("/api/db", dbApp);
app.route("/api/imports", importsApp);
app.route("/api/reports", reportsApp);
app.route("/api/leaderboards", leaderboardsApp);
app.route("/api/forecasts", forecastsApp);
app.route("/api/forecasting", forecastingApp);
app.route("/api/contracts", contractsApp);
app.route("/api/documents", documentsApp);
app.route("/api/invoices", invoicesApp);
app.route("/api/subscriptions", subscriptionsApp);
app.route("/api/activities", activitiesApp);
app.route("/api/webhooks", webhooksApp);
app.route("/api/search", searchApp);
app.route("/api/consent", consentApp);
app.route("/api/productivity", productivityApp);
app.route("/api/sales", salesApp);

// Activities & Chronological Task Timelines REST API Endpoints

// Analytical Reporting & Saved Views REST API Endpoints

// Product Catalog REST API Routes

// Pricebook Catalog REST API Routes

// Opportunity Line Items REST API Routes with Automatic Amount Rollup

// Quota Configuration REST API Route

// Custom Stage Probabilities Configuration REST API Route

// Forecast Summary Aggregate REST API Route

// Stage-to-Forecast-Category Mapping Configuration REST API Routes

// Category-Based Forecast Summary REST API Route

// Outbound Webhooks REST API Routes

// Document Templates Configuration REST API Routes

// Mail Merge Compiler Execution Route

// Subscription Management Endpoints

// Invoice Generation Endpoints

// Configure-Price-Quote (CPQ) Generation Endpoints

// Outbound Email Logging Endpoints

// Global Multi-Field Fuzzy Trigram Search Endpoint

// Global Multi-Field Fuzzy Trigram Search Endpoint (Fuzzy Alias)

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

// Email & Calendar Sync settings & runs

// Surveys & Customer Satisfaction (CSAT/NPS) API routes

// CSV Import and Column Mapping Engine for Task 0164

// Admin High Scale Seeder and Security Fuzzing endpoints for Phase 6

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
