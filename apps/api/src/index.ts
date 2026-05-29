import {
  type TenantContext,
  createSessionToken,
  verifySessionToken,
} from "@crm/auth";
import {
  type KanbanStageSummary,
  type StageGateRule,
  applyTicketMacro,
  archiveMarketingSequence,
  calculateAccountDuplicates,
  calculateAdjustedForecast,
  calculateAgentCSATMetrics,
  calculateBounceAnalytics,
  calculateCPQPrice,
  calculateCampaignROI,
  calculateCampaignRevenueShare,
  calculateCampaignStats,
  calculateContactDuplicates,
  calculateContractRenewalAmount,
  calculateGlobalCompetitorAnalytics,
  calculateLeadDuplicates,
  calculateLeadScore,
  calculateLinkEngagementAnalytics,
  calculateMilestoneDueDate,
  calculateNextRunDate,
  calculateOpenAnalytics,
  calculateOpportunityCommission,
  calculateOpportunityCompetitorStats,
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
  isContractInRenewalWindow,
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
  rollupOpportunityAmountsInBase,
  runPendingScheduledReports,
  runStoreMigrations,
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
  type DBEmailOpenEvent,
  type DBForecastAdjustment,
  type DBMarketingSequence,
  type DBMarketingSequenceFolder,
  type DBMarketingSequenceScoreTrigger,
  type DBMarketingSequenceTag,
  type DBMarketingSequenceTagMapping,
  type DBOpportunityStageGate,
  type DBStageForecastMapping,
  type DBStageGuidance,
  dbStore,
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
import {
  enqueueOutboundWebhooks,
  processOutboxItems,
  simulateWebhookDispatch,
} from "@crm/webhooks";
import { executeWorkflows } from "@crm/workflow";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";

type Env = {
  Variables: {
    tenant: TenantContext;
  };
};

const app = new Hono<Env>();
app.use("*", cors());

export const mcpTools = [
  {
    name: "crm_get_account",
    description:
      "Retrieve CRM account details by ID under strict RLS isolation.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string" },
      },
      required: ["accountId"],
    },
  },
  {
    name: "crm_list_contacts",
    description: "List CRM contact records under active row-level security.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string" },
      },
      required: ["orgId"],
    },
  },
  {
    name: "crm_get_ticket",
    description:
      "Retrieve support ticket details by ID under strict active tenant RLS isolation.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "string" },
      },
      required: ["ticketId"],
    },
  },
  {
    name: "crm_list_tickets",
    description:
      "List all support tickets for the active tenant, with optional status filter.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["Open", "In Progress", "Resolved"] },
      },
    },
  },
  {
    name: "crm_create_ticket",
    description:
      "Create a support ticket from an AI assistant, auto-matching/creating contacts and evaluating assignment rules.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
        email: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        priority: { type: "string", enum: ["Low", "Medium", "High", "Urgent"] },
        assignedToId: { type: "string" },
      },
      required: ["subject", "body", "email"],
    },
  },
  {
    name: "crm_add_ticket_comment",
    description:
      "Add a comment/reply to a support ticket under active tenant isolation.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "string" },
        body: { type: "string" },
        authorId: { type: "string" },
      },
      required: ["ticketId", "body", "authorId"],
    },
  },
  {
    name: "crm_apply_ticket_macro",
    description:
      "Apply a canned response macro to a support ticket under active tenant isolation.",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "string" },
        macroId: { type: "string" },
      },
      required: ["ticketId", "macroId"],
    },
  },
];

// Tenant verification middleware enforcing RLS integration
export const tenantAuth = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { error: "Unauthorized: Missing or invalid token format" },
      401,
    );
  }

  const token = authHeader.substring(7);
  let tenantContext: TenantContext;
  try {
    tenantContext = await verifySessionToken(token);
    c.set("tenant", tenantContext);
  } catch (err) {
    return c.json({ error: "Unauthorized: Token verification failed" }, 401);
  }

  // Propagate context database-level via RLS transaction wrapper outside the token verification catch
  return await withTenant(tenantContext.orgId, mockDb, async () => {
    return await next();
  });
});

// Helper to evaluate picklist dependencies validation
export async function enforcePicklistDependencies(
  objectType: string,
  fields: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const deps = await dbStore.picklistDependencies.findMany();
  const relevantDeps = deps.filter((d) => d.objectType === objectType);
  if (relevantDeps.length === 0) return { success: true };
  return validatePicklistDependencies(fields, relevantDeps);
}

// Helper to evaluate custom validation rules validation
export async function enforceCustomValidationRules(
  objectType: string,
  fields: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const rules = await dbStore.validationRules.findMany();
  const relevantRules = rules.filter((r) => r.objectType === objectType);
  if (relevantRules.length === 0) return { success: true };
  return validateCustomValidationRules(fields, relevantRules);
}

// Helper to fire outbound webhook notifications asynchronously to all active subscriptions of the tenant
export async function triggerOutboundWebhooks(
  orgId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  await withTenant(orgId, mockDb, async () => {
    await enqueueOutboundWebhooks(orgId, event, payload, dbStore);
    // Asynchronously process the outbox so that existing immediate expectations in standard flows are met
    processOutboxItems(orgId, dbStore).catch(() => {});
  });
}

// Helper to evaluate and run automatic lead conversion
export async function checkAndRunLeadAutoConversion(
  leadId: string,
  orgId: string,
  userId: string,
): Promise<{
  converted: boolean;
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
} | null> {
  const lead = await dbStore.leads.findOne(leadId);
  if (!lead || lead.status === "Converted") return null;

  // Recalculate lead score first
  const scoringRules = await dbStore.leadScoringRules.findMany();
  const score = calculateLeadScore(
    lead as unknown as Record<string, unknown>,
    scoringRules.map((r) => ({
      id: r.id,
      isActive: r.isActive,
      scoreValue: r.scoreValue,
      criteria: r.criteria,
    })),
  );

  // Fetch active auto-conversion rules
  const rules = await dbStore.leadAutoConversionRules.findMany();
  const activeRule = rules.find((r) => r.isActive === 1);
  if (!activeRule) return null;

  const matches = evaluateLeadAutoConversion(
    { status: lead.status, custom: lead.custom },
    score,
    activeRule.criteria,
  );

  if (!matches) return null;

  // Perform conversion
  const mappings = await dbStore.leadConversionMappings.findMany();
  const entities = convertLead({
    lead: {
      id: lead.id,
      orgId: lead.orgId,
      ownerId: lead.ownerId,
      status: lead.status,
      email: lead.email,
      company: lead.company,
      custom: lead.custom,
    },
    opportunityName:
      activeRule.createOpportunity === 1
        ? `${lead.company || lead.email}'s Opportunity`
        : undefined,
    opportunityAmount: "0.00",
  });

  const account = await dbStore.accounts.insert({
    orgId,
    ownerId: userId,
    name: entities.account.name,
    domain: null,
    custom: entities.account.custom,
  });

  const contact = await dbStore.contacts.insert({
    orgId,
    ownerId: userId,
    accountId: account.id,
    firstName: entities.contact.firstName,
    lastName: entities.contact.lastName,
    email: entities.contact.email,
    custom: entities.contact.custom,
  });

  let opportunityId: string | undefined = undefined;
  if (entities.opportunity && activeRule.createOpportunity === 1) {
    const opp = await dbStore.opportunities.insert({
      orgId,
      ownerId: userId,
      accountId: account.id,
      name: entities.opportunity.name,
      stage: activeRule.opportunityStage,
      amount: "0.00",
      closeDate: null,
      custom: null,
    });
    opportunityId = opp.id;
  }

  // Update lead
  await dbStore.leads.update(leadId, {
    status: "Converted",
    convertedAccountId: account.id,
    convertedContactId: contact.id,
  });

  // Log audit logs
  await dbStore.auditLogs.insert({
    orgId,
    recordId: leadId,
    recordType: "Lead",
    action: "update",
    userId,
    changes: {
      status: { before: lead.status, after: "Converted" },
    },
  });

  // Trigger Webhook
  triggerOutboundWebhooks(orgId, "lead.converted", {
    leadId,
    accountId: account.id,
    contactId: contact.id,
    opportunityId,
  });

  return {
    converted: true,
    accountId: account.id,
    contactId: contact.id,
    opportunityId,
  };
}

app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

app.post("/api/auth/token", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { userId, orgId, roleId, permissionsMask } = body;
  const token = await createSessionToken({
    userId: userId || "user-a",
    orgId: orgId || "org-tenant-a",
    roleId: roleId || "role-a",
    permissionsMask:
      permissionsMask !== undefined ? Number(permissionsMask) : 7,
  });
  return c.json({ success: true, token });
});

app.post("/api/public/web-to-lead", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { orgId, lastName, email, firstName, company, custom, ownerId } = body;

  if (!orgId || !lastName || !email) {
    return c.json(
      { error: "Missing required fields: orgId, lastName, email" },
      400,
    );
  }

  return await withTenant(orgId, mockDb, async () => {
    // 1. Perform custom field validation if custom fields are provided
    if (custom && typeof custom === "object") {
      const allDefs = await dbStore.fieldDefinitions.findMany();
      const leadDefs = allDefs.filter((def) => def.objectType === "leads");
      const validation = validateCustomFields(
        custom,
        leadDefs.map((def) => ({
          apiName: def.apiName,
          dataType: def.dataType,
          validationRules: def.validationRules || undefined,
        })),
      );
      if (!validation.success) {
        return c.json(
          { error: "Validation failed", errors: validation.errors },
          400,
        );
      }
    }

    // 2. Resolve ownership using active Lead Assignment Rule
    let resolvedOwnerId = ownerId || null;

    const rules = await dbStore.leadAssignmentRules.findMany();
    const activeRule = rules.find((r) => r.isActive === 1);

    if (activeRule) {
      const allEntries = await dbStore.leadAssignmentRuleEntries.findMany();
      const activeEntries = allEntries
        .filter((e) => e.ruleId === activeRule.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (activeEntries.length > 0) {
        const evalLead = {
          firstName: firstName || null,
          lastName,
          email,
          company: company || null,
          custom: custom || null,
        };
        const matchResult = evaluateLeadAssignment(evalLead, activeEntries);
        if (matchResult) {
          resolvedOwnerId = matchResult.newOwnerId;

          // Update round-robin lastAssignedIndex if needed
          const matchedEntry = activeEntries.find(
            (e) => e.id === matchResult.matchedEntryId,
          );
          if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
            await dbStore.leadAssignmentRuleEntries.update(matchedEntry.id, {
              lastAssignedIndex: matchResult.newLastAssignedIndex,
            });
          }
        }
      }
    }

    if (!resolvedOwnerId) {
      resolvedOwnerId = "user-system"; // Fallback system owner
    }

    // 3. Create Lead record under strict RLS context
    const newLead = await dbStore.leads.insert({
      orgId,
      ownerId: resolvedOwnerId,
      status: "New",
      email,
      company: company || null,
      convertedAccountId: null,
      convertedContactId: null,
      custom: custom || null,
    });

    // 4. Log audit trail
    await dbStore.auditLogs.insert({
      orgId,
      recordId: newLead.id,
      recordType: "Lead",
      action: "create",
      userId: resolvedOwnerId,
      changes: null,
    });

    // 5. Trigger Webhook
    triggerOutboundWebhooks(orgId, "lead.created", {
      id: newLead.id,
      orgId,
      ownerId: resolvedOwnerId,
      status: "New",
      email,
      company: company || null,
      custom: custom || null,
    });

    // Run auto-conversion check
    const autoConvertResult = await checkAndRunLeadAutoConversion(
      newLead.id,
      orgId,
      resolvedOwnerId,
    );

    return c.json(
      {
        success: true,
        data: newLead,
        autoConverted: autoConvertResult || null,
      },
      201,
    );
  });
});

app.post("/api/public/web-to-ticket", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    orgId,
    subject,
    body: ticketBody,
    email,
    firstName,
    lastName,
    priority,
    custom,
    assignedToId,
  } = body;

  if (!orgId || !subject || !ticketBody || !email) {
    return c.json(
      { error: "Missing required fields: orgId, subject, body, email" },
      400,
    );
  }

  return await withTenant(orgId, mockDb, async () => {
    // 1. Perform custom field validation if custom fields are provided
    if (custom && typeof custom === "object") {
      const allDefs = await dbStore.fieldDefinitions.findMany();
      const ticketDefs = allDefs.filter((def) => def.objectType === "tickets");
      const validation = validateCustomFields(
        custom,
        ticketDefs.map((def) => ({
          apiName: def.apiName,
          dataType: def.dataType,
          validationRules: def.validationRules || undefined,
        })),
      );
      if (!validation.success) {
        return c.json(
          { error: "Validation failed", errors: validation.errors },
          400,
        );
      }
    }

    // 2. Resolve or create Contact under RLS context
    let contactId = "";
    let contactCreated = false;

    const contacts = await dbStore.contacts.findMany();
    const existingContact = contacts.find((ct) => ct.email === email);

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const newContact = await dbStore.contacts.insert({
        orgId,
        email,
        firstName: firstName || null,
        lastName: lastName || "Web Contact",
        custom: null,
        accountId: null,
        ownerId: "user-system",
      });
      contactId = newContact.id;
      contactCreated = true;

      // Log contact creation audit log
      await dbStore.auditLogs.insert({
        orgId,
        recordId: contactId,
        recordType: "Contact",
        action: "create",
        userId: "user-system",
        changes: null,
      });
    }

    // 3. Resolve ticket routing & assignment using Ticket Assignment Rules
    let resolvedAssignedToId = assignedToId || null;

    const rules = await dbStore.ticketAssignmentRules.findMany();
    const activeRule = rules.find((r) => r.isActive === 1);

    if (activeRule) {
      const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
      const activeEntries = allEntries
        .filter((e) => e.ruleId === activeRule.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (activeEntries.length > 0) {
        // Compile a ticket-like object for evaluating rules
        const evalTicket = {
          subject,
          body: ticketBody,
          priority: priority || "Medium",
          custom: custom || null,
          email,
          firstName: firstName || null,
          lastName: lastName || "Web Contact",
        };

        const matchResult = evaluateTicketAssignment(evalTicket, activeEntries);
        if (matchResult) {
          resolvedAssignedToId = matchResult.newAssignedToId;

          // Update lastAssignedIndex if round-robin
          const matchedEntry = activeEntries.find(
            (e) => e.id === matchResult.matchedEntryId,
          );
          if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
            await dbStore.ticketAssignmentRuleEntries.update(matchedEntry.id, {
              lastAssignedIndex: matchResult.newLastAssignedIndex,
            });
          }
        }
      }
    }

    if (!resolvedAssignedToId) {
      resolvedAssignedToId = "user-system"; // Fallback system owner
    }

    // 4. Create Ticket record under active RLS context
    const newTicket = await dbStore.tickets.insert({
      orgId,
      contactId,
      subject,
      status: "Open",
      priority: priority || "Medium",
      assignedToId: resolvedAssignedToId,
    });

    // 5. Log audit trail
    await dbStore.auditLogs.insert({
      orgId,
      recordId: newTicket.id,
      recordType: "Ticket",
      action: "create",
      userId: resolvedAssignedToId,
      changes: null,
    });

    // 6. Trigger Webhook
    triggerOutboundWebhooks(orgId, "ticket.created", {
      id: newTicket.id,
      orgId,
      contactId,
      subject,
      body: ticketBody,
      status: "Open",
      priority: priority || "Medium",
      assignedToId: resolvedAssignedToId,
      custom: custom || null,
    });

    return c.json(
      {
        success: true,
        data: newTicket,
        contactCreated,
      },
      201,
    );
  });
});

app.get("/mcp/tools", (c) => c.json({ tools: mcpTools }));

// Model Context Protocol (MCP) Tool Call Executor Route
app.post("/mcp/tools/call", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, arguments: args } = body;

  if (!name) {
    return c.json({ error: "Missing tool name parameter" }, 400);
  }

  if (name === "crm_get_account") {
    const accountId = args?.accountId;
    if (!accountId) {
      return c.json({ error: "Missing required argument: accountId" }, 400);
    }
    const account = await dbStore.accounts.findOne(accountId);
    return c.json({
      content: [
        {
          type: "text",
          text: JSON.stringify(account),
        },
      ],
    });
  }

  if (name === "crm_list_contacts") {
    const contacts = await dbStore.contacts.findMany();
    return c.json({
      content: [
        {
          type: "text",
          text: JSON.stringify(contacts),
        },
      ],
    });
  }

  if (name === "crm_get_ticket") {
    const ticketId = args?.ticketId;
    if (!ticketId) {
      return c.json({ error: "Missing required argument: ticketId" }, 400);
    }
    const ticket = await dbStore.tickets.findOne(ticketId);
    return c.json({
      content: [
        {
          type: "text",
          text: JSON.stringify(ticket),
        },
      ],
    });
  }

  if (name === "crm_list_tickets") {
    const statusFilter = args?.status;
    const allTickets = await dbStore.tickets.findMany();
    const filteredTickets = statusFilter
      ? allTickets.filter((t) => t.status === statusFilter)
      : allTickets;
    return c.json({
      content: [
        {
          type: "text",
          text: JSON.stringify(filteredTickets),
        },
      ],
    });
  }

  if (name === "crm_create_ticket") {
    const {
      subject,
      body: ticketBody,
      email,
      firstName,
      lastName,
      priority,
      assignedToId,
    } = args || {};
    if (!subject || !ticketBody || !email) {
      return c.json(
        { error: "Missing required arguments: subject, body, email" },
        400,
      );
    }

    const orgId = tenant.orgId;

    // Contact auto-matching or creation
    let contactId = "";
    const contacts = await dbStore.contacts.findMany();
    const existingContact = contacts.find((ct) => ct.email === email);

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const newContact = await dbStore.contacts.insert({
        orgId,
        email,
        firstName: firstName || null,
        lastName: lastName || "Web Contact",
        custom: null,
        accountId: null,
        ownerId: "user-system",
      });
      contactId = newContact.id;

      await dbStore.auditLogs.insert({
        orgId,
        recordId: contactId,
        recordType: "Contact",
        action: "create",
        userId: tenant.userId || "user-system",
        changes: null,
      });
    }

    // Assignment routing
    let resolvedAssignedToId = assignedToId || null;
    const rules = await dbStore.ticketAssignmentRules.findMany();
    const activeRule = rules.find((r) => r.isActive === 1);

    if (activeRule) {
      const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
      const activeEntries = allEntries
        .filter((e) => e.ruleId === activeRule.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (activeEntries.length > 0) {
        const evalTicket = {
          subject,
          body: ticketBody,
          priority: priority || "Medium",
          custom: null,
          email,
          firstName: firstName || null,
          lastName: lastName || "Web Contact",
        };

        const matchResult = evaluateTicketAssignment(evalTicket, activeEntries);
        if (matchResult) {
          resolvedAssignedToId = matchResult.newAssignedToId;

          const matchedEntry = activeEntries.find(
            (e) => e.id === matchResult.matchedEntryId,
          );
          if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
            await dbStore.ticketAssignmentRuleEntries.update(matchedEntry.id, {
              lastAssignedIndex: matchResult.newLastAssignedIndex,
            });
          }
        }
      }
    }

    if (!resolvedAssignedToId) {
      resolvedAssignedToId = tenant.userId || "user-system";
    }

    const newTicket = await dbStore.tickets.insert({
      orgId,
      contactId,
      subject,
      status: "Open",
      priority: priority || "Medium",
      assignedToId: resolvedAssignedToId,
    });

    await dbStore.auditLogs.insert({
      orgId,
      recordId: newTicket.id,
      recordType: "Ticket",
      action: "create",
      userId: tenant.userId || resolvedAssignedToId,
      changes: null,
    });

    triggerOutboundWebhooks(orgId, "ticket.created", {
      id: newTicket.id,
      orgId,
      contactId,
      subject,
      body: ticketBody,
      status: "Open",
      priority: priority || "Medium",
      assignedToId: resolvedAssignedToId,
      custom: null,
    });

    return c.json({
      content: [
        {
          type: "text",
          text: JSON.stringify(newTicket),
        },
      ],
    });
  }

  if (name === "crm_add_ticket_comment") {
    const { ticketId, body: commentBody, authorId } = args || {};
    if (!ticketId || !commentBody || !authorId) {
      return c.json(
        { error: "Missing required arguments: ticketId, body, authorId" },
        400,
      );
    }

    const ticket = await dbStore.tickets.findOne(ticketId);
    if (!ticket) {
      return c.json({ error: "Ticket not found" }, 404);
    }

    const newComment = await dbStore.ticketComments.insert({
      orgId: tenant.orgId,
      ticketId,
      authorId,
      body: commentBody,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: ticketId,
      recordType: "Ticket",
      action: "comment_added",
      userId: tenant.userId || authorId,
      changes: {
        commentId: { before: null, after: newComment.id },
      },
    });

    return c.json({
      content: [
        {
          type: "text",
          text: JSON.stringify(newComment),
        },
      ],
    });
  }

  if (name === "crm_apply_ticket_macro") {
    const { ticketId, macroId } = args || {};
    if (!ticketId || !macroId) {
      return c.json(
        { error: "Missing required arguments: ticketId, macroId" },
        400,
      );
    }

    const ticket = await dbStore.tickets.findOne(ticketId);
    if (!ticket) {
      return c.json({ error: "Ticket not found" }, 404);
    }

    const macro = await dbStore.ticketMacros.findOne(macroId);
    if (!macro) {
      return c.json({ error: "Macro not found" }, 404);
    }

    const result = applyTicketMacro({
      ticket: {
        id: ticket.id,
        orgId: ticket.orgId,
        status: ticket.status as "Open" | "In Progress" | "Resolved",
        priority: ticket.priority as "Low" | "Medium" | "High" | "Urgent",
      },
      macro: {
        id: macro.id,
        orgId: macro.orgId,
        name: macro.name,
        cannedResponse: macro.cannedResponse,
        updateStatus: macro.updateStatus as
          | "Open"
          | "In Progress"
          | "Resolved"
          | null,
        updatePriority: macro.updatePriority as
          | "Low"
          | "Medium"
          | "High"
          | "Urgent"
          | null,
      },
    });

    const updates: Record<string, unknown> = {};
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    if (result.updatedStatus !== ticket.status) {
      updates.status = result.updatedStatus;
      changes.status = { before: ticket.status, after: result.updatedStatus };
    }
    if (result.updatedPriority !== ticket.priority) {
      updates.priority = result.updatedPriority;
      changes.priority = {
        before: ticket.priority,
        after: result.updatedPriority,
      };
    }

    if (Object.keys(updates).length > 0) {
      await dbStore.tickets.update(ticketId, updates);
    }

    const newComment = await dbStore.ticketComments.insert({
      orgId: tenant.orgId,
      ticketId,
      authorId: tenant.userId || "user-system",
      body: result.commentBody,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: ticketId,
      recordType: "Ticket",
      action: "macro_applied",
      userId: tenant.userId || "user-system",
      changes: {
        macroId: { before: null, after: macroId },
        commentId: { before: null, after: newComment.id },
        ...changes,
      },
    });

    return c.json({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            comment: newComment,
            ticket: { ...ticket, ...updates },
          }),
        },
      ],
    });
  }

  return c.json({ error: "Unknown MCP tool called" }, 400);
});

// Metadata Management Endpoints
app.post("/api/metadata/fields", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { objectType, apiName, label, dataType, validationRules } = body;

  if (!objectType || !apiName || !label || !dataType) {
    return c.json({ error: "Missing required metadata parameters" }, 400);
  }

  const def = await dbStore.fieldDefinitions.insert({
    orgId: tenant.orgId,
    objectType,
    apiName,
    label,
    dataType,
    validationRules: validationRules || null,
  });

  return c.json({ success: true, data: def });
});

app.get("/api/metadata/fields", tenantAuth, async (c) => {
  const fields = await dbStore.fieldDefinitions.findMany();
  return c.json({ success: true, data: fields });
});

app.post("/api/metadata/picklist-dependencies", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { objectType, parentField, dependentField, dependencyMap } = body;

  if (!objectType || !parentField || !dependentField || !dependencyMap) {
    return c.json(
      { error: "Missing required picklist dependency parameters" },
      400,
    );
  }

  const dep = await dbStore.picklistDependencies.insert({
    orgId: tenant.orgId,
    objectType,
    parentField,
    dependentField,
    dependencyMap,
  });

  return c.json({ success: true, data: dep });
});

app.get("/api/metadata/picklist-dependencies", tenantAuth, async (c) => {
  const deps = await dbStore.picklistDependencies.findMany();
  return c.json({ success: true, data: deps });
});

app.delete("/api/metadata/picklist-dependencies/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.picklistDependencies.delete(id);
  if (!deleted) {
    return c.json(
      { error: "Picklist dependency not found or tenant mismatch" },
      404,
    );
  }
  return c.json({ success: true });
});

app.post("/api/metadata/validation-rules", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, description, objectType, errorMessage, criteria, isActive } =
    body;

  if (!name || !objectType || !errorMessage || !criteria) {
    return c.json(
      { error: "Missing required validation rule parameters" },
      400,
    );
  }

  const rule = await dbStore.validationRules.insert({
    orgId: tenant.orgId,
    name,
    description: description || null,
    objectType,
    errorMessage,
    criteria,
    isActive: isActive !== undefined ? Number(isActive) : 1,
  });

  return c.json({ success: true, data: rule });
});

app.get("/api/metadata/validation-rules", tenantAuth, async (c) => {
  const rules = await dbStore.validationRules.findMany();
  return c.json({ success: true, data: rules });
});

app.delete("/api/metadata/validation-rules/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.validationRules.delete(id);
  if (!deleted) {
    return c.json(
      { error: "Validation rule not found or tenant mismatch" },
      404,
    );
  }
  return c.json({ success: true });
});

app.post("/api/metadata/layouts/:objectType", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const objectType = c.req.param("objectType");
  const body = await c.req.json().catch(() => ({}));
  const { sections } = body;

  if (!sections) {
    return c.json({ error: "Missing sections layout structure" }, 400);
  }

  const layout = await dbStore.layoutDefinitions.insert({
    orgId: tenant.orgId,
    objectType,
    sections,
  });

  return c.json({ success: true, data: layout });
});

app.get("/api/metadata/layouts/:objectType", tenantAuth, async (c) => {
  const objectType = c.req.param("objectType");
  const layoutDef = await dbStore.layoutDefinitions.findOne(objectType);

  const fields = await dbStore.fieldDefinitions.findMany();
  const customFieldNames = fields
    .filter((f) => f.objectType === objectType)
    .map((f) => f.apiName);

  const baseLayout = layoutDef || {
    sections: [{ title: "Standard Info", fields: ["name", "email"] }],
  };

  const compiled = compileFormLayout(customFieldNames, baseLayout);
  return c.json({ success: true, data: compiled });
});

// Workflow Automation Endpoints
app.post("/api/workflows", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, triggerEvent, conditions, actions } = body;

  if (!name || !triggerEvent || !actions) {
    return c.json({ error: "Missing required workflow rules parameters" }, 400);
  }

  const newRule = await dbStore.workflows.insert({
    orgId: tenant.orgId,
    name,
    triggerEvent,
    conditions: conditions || null,
    actions,
  });

  return c.json({ success: true, data: newRule });
});

app.get("/api/workflows", tenantAuth, async (c) => {
  const rules = await dbStore.workflows.findMany();
  return c.json({ success: true, data: rules });
});

// Support Ticketing (Service-Lite Extension) Endpoints
app.post("/api/tickets", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { contactId, subject } = body;

  if (!contactId || !subject) {
    return c.json({ error: "Missing required ticketing parameters" }, 400);
  }

  // Generate support ticket representation
  const ticketData = createTicket({
    orgId: tenant.orgId,
    contactId,
    subject,
  });

  // Persist into database store under active RLS isolation context
  const newTicket = await dbStore.tickets.insert({
    orgId: tenant.orgId,
    contactId: ticketData.contactId,
    subject: ticketData.subject,
    status: ticketData.status,
  });

  return c.json({ success: true, data: newTicket });
});

app.get("/api/tickets", tenantAuth, async (c) => {
  const tickets = await dbStore.tickets.findMany();
  return c.json({ success: true, data: tickets });
});

app.post("/api/tickets/:id/resolve", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(id);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  // Resolve Ticket and mutate status
  const resolved = resolveTicket(ticket);
  const updated = await dbStore.tickets.update(id, {
    status: resolved.status,
  });

  if (updated) {
    triggerOutboundWebhooks(
      updated.orgId,
      "ticket.resolved",
      updated as unknown as Record<string, unknown>,
    );
  }

  return c.json({ success: true, data: updated });
});

// Support Ticket Assignment Rules REST API Endpoints protected by tenantAuth
app.post("/api/service/tickets/routing-rules", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, isActive } = body;

  if (!name) {
    return c.json({ error: "Missing required routing rule name" }, 400);
  }

  const activeVal = isActive !== undefined ? Number(isActive) : 0;

  if (activeVal === 1) {
    const allRules = await dbStore.ticketAssignmentRules.findMany();
    for (const r of allRules) {
      if (r.isActive === 1) {
        await dbStore.ticketAssignmentRules.update(r.id, { isActive: 0 });
      }
    }
  }

  const newRule = await dbStore.ticketAssignmentRules.insert({
    orgId: tenant.orgId,
    name,
    isActive: activeVal,
  });

  // Audit Log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newRule.id,
    recordType: "ticket_assignment_rules",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: newRule }, 201);
});

app.get("/api/service/tickets/routing-rules", tenantAuth, async (c) => {
  const rules = await dbStore.ticketAssignmentRules.findMany();
  return c.json({ success: true, data: rules });
});

app.post(
  "/api/service/tickets/routing-rules/:id/entries",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const ruleId = c.req.param("id");
    const rule = await dbStore.ticketAssignmentRules.findOne(ruleId);
    if (!rule) {
      return c.json({ error: "Routing rule not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const { sortOrder, routingMethod, routingUserIds, criteria } = body;

    if (
      sortOrder === undefined ||
      !routingMethod ||
      !routingUserIds ||
      !criteria
    ) {
      return c.json({ error: "Missing required rule entry parameters" }, 400);
    }

    const entry = await dbStore.ticketAssignmentRuleEntries.insert({
      orgId: tenant.orgId,
      ruleId,
      sortOrder: Number(sortOrder),
      routingMethod,
      routingUserIds,
      lastAssignedIndex: -1,
      criteria,
    });

    // Audit Log
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: entry.id,
      recordType: "ticket_assignment_rule_entries",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });

    return c.json({ success: true, data: entry }, 201);
  },
);

app.get(
  "/api/service/tickets/routing-rules/:id/entries",
  tenantAuth,
  async (c) => {
    const ruleId = c.req.param("id");
    const rule = await dbStore.ticketAssignmentRules.findOne(ruleId);
    if (!rule) {
      return c.json({ error: "Routing rule not found" }, 404);
    }

    const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
    const ruleEntries = allEntries
      .filter((e) => e.ruleId === ruleId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return c.json({ success: true, data: ruleEntries });
  },
);

app.post("/api/service/tickets/:id/route", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(id);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  // Fetch active assignment rule for the tenant
  const rules = await dbStore.ticketAssignmentRules.findMany();
  const activeRule = rules.find((r) => r.isActive === 1);
  if (!activeRule) {
    return c.json({ error: "No active ticket assignment rule found" }, 400);
  }

  const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
  const activeEntries = allEntries
    .filter((e) => e.ruleId === activeRule.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const match = evaluateTicketAssignment(
    ticket as unknown as Record<string, unknown>,
    activeEntries,
  );

  if (!match) {
    return c.json(
      { error: "No matching routing entry found for this ticket" },
      400,
    );
  }

  const oldAssignedToId = ticket.assignedToId || null;
  const updatedTicket = await dbStore.tickets.update(id, {
    assignedToId: match.newAssignedToId,
  });

  // Update lastAssignedIndex for round robin entry
  const matchedEntry = activeEntries.find((e) => e.id === match.matchedEntryId);
  if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
    await dbStore.ticketAssignmentRuleEntries.update(matchedEntry.id, {
      lastAssignedIndex: match.newLastAssignedIndex,
    });
  }

  // Audit Log for assignment transition
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Ticket",
    action: "assign",
    userId: tenant.userId,
    changes: {
      assignedToId: { before: oldAssignedToId, after: match.newAssignedToId },
    },
  });

  triggerOutboundWebhooks(tenant.orgId, "ticket.routed", {
    ticketId: id,
    assignedToId: match.newAssignedToId,
  });

  return c.json({ success: true, data: updatedTicket });
});

app.put("/api/service/tickets/:id/assign", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(id);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { assignedToId } = body;

  const oldAssignedToId = ticket.assignedToId || null;
  const updated = await dbStore.tickets.update(id, {
    assignedToId: assignedToId || null,
  });

  // Audit Log for manual assignment
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Ticket",
    action: "assign",
    userId: tenant.userId,
    changes: {
      assignedToId: { before: oldAssignedToId, after: assignedToId || null },
    },
  });

  triggerOutboundWebhooks(tenant.orgId, "ticket.assigned", {
    ticketId: id,
    assignedToId: assignedToId || null,
  });

  return c.json({ success: true, data: updated });
});

// Lead Conversion Mapping Endpoints protected by tenantAuth
app.get("/api/lead-conversions/mappings", tenantAuth, async (c) => {
  const mappings = await dbStore.leadConversionMappings.findMany();
  return c.json({ success: true, data: mappings });
});

app.post("/api/lead-conversions/mappings", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { sourceLeadField, targetObjectType, targetField } = body;

  if (!sourceLeadField || !targetObjectType || !targetField) {
    return c.json({ error: "Missing required mapping parameters" }, 400);
  }

  if (!["accounts", "contacts", "opportunities"].includes(targetObjectType)) {
    return c.json({ error: "Invalid targetObjectType" }, 400);
  }

  const mapping = await dbStore.leadConversionMappings.insert({
    orgId: tenant.orgId,
    sourceLeadField,
    targetObjectType,
    targetField,
  });

  // Audit Log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: mapping.id,
    recordType: "lead_conversion_mappings",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: mapping }, 201);
});

app.delete("/api/lead-conversions/mappings/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const mapping = await dbStore.leadConversionMappings.findOne(id);
  if (!mapping) {
    return c.json({ error: "Mapping not found" }, 404);
  }

  await dbStore.leadConversionMappings.delete(id);

  // Audit Log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "lead_conversion_mappings",
    action: "delete",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true });
});

// Currencies REST API Endpoints protected by tenantAuth
app.get("/api/currencies", tenantAuth, async (c) => {
  const currencies = await dbStore.currencies.findMany();
  return c.json({ success: true, data: currencies });
});

app.get("/api/currencies/convert", tenantAuth, async (c) => {
  const amount = c.req.query("amount");
  const fromIso = c.req.query("from");
  const toIso = c.req.query("to");

  if (!amount || !fromIso || !toIso) {
    return c.json(
      { error: "Missing conversion query parameters: amount, from, to" },
      400,
    );
  }

  const fromCurr = await dbStore.currencies.findByIsoCode(fromIso);
  const toCurr = await dbStore.currencies.findByIsoCode(toIso);

  const fromRate = fromCurr?.isActive ? fromCurr.exchangeRate : "1.0000";
  const toRate = toCurr?.isActive ? toCurr.exchangeRate : "1.0000";

  const converted = convertCurrency(amount, fromRate, toRate);
  return c.json({ success: true, converted });
});

app.post("/api/currencies", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { isoCode, displayName, symbol, exchangeRate, isCorporate } = body;

  if (!isoCode || !displayName || !symbol || !exchangeRate) {
    return c.json({ error: "Missing required currency parameters" }, 400);
  }

  const existing = await dbStore.currencies.findByIsoCode(isoCode);
  let currency: DBCurrency | null = null;

  if (isCorporate) {
    const allCurrencies = await dbStore.currencies.findMany();
    for (const cur of allCurrencies) {
      if (cur.isCorporate) {
        await dbStore.currencies.update(cur.id, { isCorporate: false });
      }
    }
  }

  if (existing) {
    currency = await dbStore.currencies.update(existing.id, {
      displayName,
      symbol,
      exchangeRate: String(exchangeRate),
      isCorporate:
        isCorporate !== undefined ? Boolean(isCorporate) : existing.isCorporate,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: existing.id,
      recordType: "currencies",
      action: "update",
      userId: tenant.userId,
      changes: null,
    });
  } else {
    currency = await dbStore.currencies.insert({
      orgId: tenant.orgId,
      isoCode,
      displayName,
      symbol,
      exchangeRate: String(exchangeRate),
      isCorporate: isCorporate !== undefined ? Boolean(isCorporate) : false,
      isActive: true,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: currency.id,
      recordType: "currencies",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });
  }

  return c.json({ success: true, data: currency }, 201);
});

// Sales Path Stage Guidance REST API Endpoints protected by tenantAuth
app.get("/api/stage-guidance", tenantAuth, async (c) => {
  const guidance = await dbStore.stageGuidance.findMany();
  return c.json({ success: true, data: guidance });
});

app.get("/api/stage-guidance/:objectType/:stage", tenantAuth, async (c) => {
  const { objectType, stage } = c.req.param();
  const allGuidance = await dbStore.stageGuidance.findMany();
  const active = allGuidance.find(
    (g) => g.objectType === objectType && g.stage === stage && g.isActive,
  );
  return c.json({ success: true, data: active || null });
});

app.post("/api/stage-guidance", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { id, objectType, stage, keyFields, guidanceText, isActive } = body;

  if (!objectType || !stage || !keyFields || guidanceText === undefined) {
    return c.json({ error: "Missing required stage guidance parameters" }, 400);
  }

  let entry: DBStageGuidance | null = null;

  if (id) {
    const existing = await dbStore.stageGuidance.findOne(id);
    if (!existing) {
      return c.json({ error: "Stage guidance not found" }, 404);
    }
    entry = await dbStore.stageGuidance.update(id, {
      objectType,
      stage,
      keyFields,
      guidanceText,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "stage_guidance",
      action: "update",
      userId: tenant.userId,
      changes: null,
    });
  } else {
    entry = await dbStore.stageGuidance.insert({
      orgId: tenant.orgId,
      objectType,
      stage,
      keyFields,
      guidanceText,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: entry.id,
      recordType: "stage_guidance",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });
  }

  return c.json({ success: true, data: entry }, id ? 200 : 201);
});

// Stage Gates REST API Endpoints protected by tenantAuth
app.get("/api/stage-gates", tenantAuth, async (c) => {
  const gates = await dbStore.opportunityStageGates.findMany();
  return c.json({ success: true, data: gates });
});

app.post("/api/stage-gates", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    id,
    targetStage,
    field,
    operator,
    expectedValue,
    errorMessage,
    isActive,
  } = body;

  if (!targetStage || !field || !operator || !errorMessage) {
    return c.json({ error: "Missing required stage gate parameters" }, 400);
  }

  let gate: DBOpportunityStageGate | null = null;

  if (id) {
    const existing = await dbStore.opportunityStageGates.findOne(id);
    if (!existing) {
      return c.json({ error: "Stage gate not found" }, 404);
    }
    gate = await dbStore.opportunityStageGates.update(id, {
      targetStage,
      field,
      operator,
      expectedValue:
        expectedValue !== undefined
          ? String(expectedValue)
          : existing.expectedValue,
      errorMessage,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "opportunity_stage_gates",
      action: "update",
      userId: tenant.userId,
      changes: null,
    });
  } else {
    gate = await dbStore.opportunityStageGates.insert({
      orgId: tenant.orgId,
      targetStage,
      field,
      operator,
      expectedValue: expectedValue !== undefined ? String(expectedValue) : null,
      errorMessage,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: gate.id,
      recordType: "opportunity_stage_gates",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });
  }

  return c.json({ success: true, data: gate }, 201);
});

// Lead operations protected by tenantAuth
app.post("/api/leads", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { email, company, status, custom } = body;

  // Perform dynamic validation against tenant custom field schemas
  if (custom && typeof custom === "object") {
    const allDefs = await dbStore.fieldDefinitions.findMany();
    const leadDefs = allDefs.filter((def) => def.objectType === "leads");
    const validation = validateCustomFields(
      custom,
      leadDefs.map((def) => ({
        apiName: def.apiName,
        dataType: def.dataType,
        validationRules: def.validationRules || undefined,
      })),
    );
    if (!validation.success) {
      return c.json(
        { error: "Validation failed", errors: validation.errors },
        400,
      );
    }
  }

  // Validate picklist dependencies
  const pldValidation = await enforcePicklistDependencies("leads", {
    ...body,
    ...(custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  // Validate custom validation rules
  const customValValidation = await enforceCustomValidationRules("leads", {
    ...body,
    ...(custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  const leadData = {
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    status: status || "New",
    email: email || null,
    company: company || null,
    convertedAccountId: null,
    convertedContactId: null,
    custom: custom || null,
  };

  const newLead = await dbStore.leads.insert(leadData);

  // Log audit trail
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newLead.id,
    recordType: "Lead",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  // Trigger Webhook
  triggerOutboundWebhooks(
    tenant.orgId,
    "lead.created",
    newLead as unknown as Record<string, unknown>,
  );

  // SLA Tracker setup if active target exists
  const targets = await dbStore.leadSlaTargets.findMany();
  const activeTarget = targets.find((t) => t.isActive === 1);
  if (activeTarget) {
    await dbStore.leadSlaTrackers.insert({
      orgId: tenant.orgId,
      leadId: newLead.id,
      targetId: activeTarget.id,
      status: "Pending",
      respondedAt: null,
      responseTimeMinutes: null,
    });
  }

  // Run auto-conversion check
  const autoConvertResult = await checkAndRunLeadAutoConversion(
    newLead.id,
    tenant.orgId,
    tenant.userId,
  );

  return c.json({
    success: true,
    data: newLead,
    autoConverted: autoConvertResult || null,
  });
});

app.get("/api/leads", tenantAuth, async (c) => {
  const leads = await dbStore.leads.findMany();
  return c.json({ success: true, data: leads });
});

app.get("/api/leads/auto-conversion-rules", tenantAuth, async (c) => {
  const rules = await dbStore.leadAutoConversionRules.findMany();
  return c.json({ success: true, data: rules });
});

app.post("/api/leads/auto-conversion-rules", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, isActive, createOpportunity, opportunityStage, criteria } =
    body;

  if (!name || !criteria) {
    return c.json(
      {
        error:
          "Missing required auto-conversion rule parameters: name, criteria",
      },
      400,
    );
  }

  // Deactivate existing rules if the new one is active (only one active rule is allowed)
  if (isActive === 1) {
    const existingRules = await dbStore.leadAutoConversionRules.findMany();
    for (const r of existingRules) {
      if (r.isActive === 1) {
        await dbStore.leadAutoConversionRules.update(r.id, { isActive: 0 });
      }
    }
  }

  const rule = await dbStore.leadAutoConversionRules.insert({
    orgId: tenant.orgId,
    name,
    isActive: isActive !== undefined ? Number(isActive) : 1,
    createOpportunity:
      createOpportunity !== undefined ? Number(createOpportunity) : 1,
    opportunityStage: opportunityStage || "Qualification",
    criteria,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: rule.id,
    recordType: "LeadAutoConversionRule",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: rule }, 201);
});

// Lead SLA configurations & Response Aging Tracking Endpoints
app.post("/api/leads/sla-targets", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { maxResponseTimeMinutes } = body;

  const targetMinutes =
    maxResponseTimeMinutes !== undefined ? Number(maxResponseTimeMinutes) : 60;

  // Deactivate all previous SLA targets for the tenant org
  const existingTargets = await dbStore.leadSlaTargets.findMany();
  for (const t of existingTargets) {
    if (t.isActive === 1) {
      await dbStore.leadSlaTargets.update(t.id, { isActive: 0 });
    }
  }

  // Insert the new SLA target
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

app.get("/api/leads/sla-targets", tenantAuth, async (c) => {
  const targets = await dbStore.leadSlaTargets.findMany();
  const activeTarget = targets.find((t) => t.isActive === 1);
  return c.json({ success: true, data: activeTarget || null });
});

app.get("/api/leads/sla-breaches", tenantAuth, async (c) => {
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

      triggerOutboundWebhooks(tenant.orgId, "lead.sla_breached", {
        leadId: tracker.leadId,
        trackerId: tracker.id,
        responseTimeMinutes: slaStatus.responseTimeMinutes,
      });
    }
  }

  // Reload trackers and filter by Breached status
  const reloaded = await dbStore.leadSlaTrackers.findMany();
  const breached = reloaded.filter((t) => t.status === "Breached");

  return c.json({ success: true, data: breached });
});

app.post("/api/leads/:id/respond", tenantAuth, async (c) => {
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
    triggerOutboundWebhooks(tenant.orgId, "lead.sla_resolved", {
      leadId: id,
      trackerId: tracker.id,
      status: "Met",
      responseTimeMinutes: slaStatus.responseTimeMinutes,
    });
  } else if (slaStatus.status === "Breached") {
    triggerOutboundWebhooks(tenant.orgId, "lead.sla_breached", {
      leadId: id,
      trackerId: tracker.id,
      status: "Breached",
      responseTimeMinutes: slaStatus.responseTimeMinutes,
    });
  }

  return c.json({ success: true, data: updatedTracker });
});

app.get("/api/leads/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }
  return c.json({ success: true, data: lead });
});

app.patch("/api/leads/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { email, company, status, custom } = body;

  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }

  // Validate custom fields if updated
  if (custom && typeof custom === "object") {
    const allDefs = await dbStore.fieldDefinitions.findMany();
    const leadDefs = allDefs.filter((def) => def.objectType === "leads");
    const validation = validateCustomFields(
      custom,
      leadDefs.map((def) => ({
        apiName: def.apiName,
        dataType: def.dataType,
        validationRules: def.validationRules || undefined,
      })),
    );
    if (!validation.success) {
      return c.json(
        { error: "Validation failed", errors: validation.errors },
        400,
      );
    }
  }

  // Validate picklist dependencies
  const combinedForValidation = {
    ...lead,
    ...body,
    custom: {
      ...(lead.custom || {}),
      ...(custom || {}),
    },
  };
  const pldValidation = await enforcePicklistDependencies("leads", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  // Validate custom validation rules
  const customValValidation = await enforceCustomValidationRules("leads", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (email !== undefined) updates.email = email;
  if (company !== undefined) updates.company = company;
  if (status !== undefined) updates.status = status;
  if (custom !== undefined) updates.custom = custom;

  const updatedLead = await dbStore.leads.update(id, updates);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Lead",
    action: "update",
    userId: tenant.userId,
    changes: {
      update: { before: lead, after: updatedLead },
    },
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

app.get("/api/leads/:id/duplicates", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const sourceLead = await dbStore.leads.findOne(id);
  if (!sourceLead) {
    return c.json({ error: "Lead not found" }, 404);
  }
  const allLeads = await dbStore.leads.findMany();
  const duplicates = calculateLeadDuplicates(sourceLead, allLeads);
  return c.json({ success: true, data: duplicates });
});

app.post("/api/leads/:id/merge", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { duplicateId, fieldResolution } = body;

  if (!duplicateId || !fieldResolution) {
    return c.json(
      { error: "Missing duplicateId or fieldResolution parameters" },
      400,
    );
  }

  const master = await dbStore.leads.findOne(id);
  const duplicate = await dbStore.leads.findOne(duplicateId);

  if (!master || !duplicate) {
    return c.json({ error: "Master or duplicate lead not found" }, 404);
  }

  if (master.orgId !== tenant.orgId || duplicate.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  // Perform core merge logic
  const mergedLead = mergeLeads({ master, duplicate, fieldResolution });

  // Update master lead
  const updatedMaster = await dbStore.leads.update(id, {
    email: mergedLead.email,
    company: mergedLead.company,
    status: mergedLead.status,
    custom: mergedLead.custom,
  });

  if (!updatedMaster) {
    return c.json({ error: "Failed to update master lead" }, 500);
  }

  // Consolidate activity links
  for (const link of store.activityLinks) {
    if (
      link.orgId === tenant.orgId &&
      link.targetType === "Lead" &&
      link.targetId === duplicateId
    ) {
      link.targetId = id;
    }
  }

  // Consolidate campaign memberships
  const duplicateMemberships = store.campaignMembers.filter(
    (m) => m.orgId === tenant.orgId && m.leadId === duplicateId,
  );

  for (const dupMember of duplicateMemberships) {
    const masterAlreadyInCampaign = store.campaignMembers.some(
      (m) =>
        m.orgId === tenant.orgId &&
        m.campaignId === dupMember.campaignId &&
        m.leadId === id,
    );
    if (masterAlreadyInCampaign) {
      // Delete duplicate campaign member
      const idx = store.campaignMembers.findIndex((m) => m.id === dupMember.id);
      if (idx !== -1) {
        store.campaignMembers.splice(idx, 1);
      }
    } else {
      // Update leadId to master ID
      dupMember.leadId = id;
    }
  }

  // Delete duplicate lead
  await dbStore.leads.delete(duplicateId);

  // Log audit log for master lead update
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Lead",
    action: "update",
    userId: tenant.userId,
    changes: {
      merge: { before: duplicateId, after: "merged_into_master" },
    },
  });

  // Trigger outbound webhook lead.merged
  triggerOutboundWebhooks(tenant.orgId, "lead.merged", {
    leadId: id,
    mergedLeadId: duplicateId,
    finalLead: updatedMaster,
  });

  return c.json({ success: true, data: updatedMaster });
});

app.post("/api/leads/:id/convert", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { opportunityName, opportunityAmount } = body;

  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }

  if (lead.status === "Converted") {
    return c.json({ error: "Lead is already converted" }, 400);
  }

  // Fetch active conversion mappings
  const mappings = await dbStore.leadConversionMappings.findMany();

  // Pure mapping via @crm/core
  const entities = convertLeadWithMappings({
    lead,
    opportunityName,
    opportunityAmount,
    mappings,
  });

  // DB inserts with correct tenant active context
  const account = await dbStore.accounts.insert({
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    name: entities.account.name,
    // biome-ignore lint/suspicious/noExplicitAny: dynamic field access
    domain: (entities.account as any).domain || null,
    custom: entities.account.custom,
  });

  const contact = await dbStore.contacts.insert({
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    accountId: account.id,
    firstName: entities.contact.firstName,
    lastName: entities.contact.lastName,
    email: entities.contact.email,
    custom: entities.contact.custom,
  });

  let opportunityId: string | undefined = undefined;
  let workflowExecution:
    | { dispatchedWebhooks: string[]; notificationsCreated: string[] }
    | undefined = undefined;

  if (entities.opportunity) {
    const opp = await dbStore.opportunities.insert({
      orgId: tenant.orgId,
      ownerId: tenant.userId,
      accountId: account.id,
      name: entities.opportunity.name,
      stage: entities.opportunity.stage,
      amount: entities.opportunity.amount,
      // biome-ignore lint/suspicious/noExplicitAny: dynamic field access
      closeDate: (entities.opportunity as any).closeDate
        ? // biome-ignore lint/suspicious/noExplicitAny: dynamic field access
          new Date((entities.opportunity as any).closeDate)
        : null,
      custom: entities.opportunity.custom || null,
    });
    opportunityId = opp.id;

    // Trigger dynamic automated workflows matching trigger events
    const rules = await dbStore.workflows.findMany();
    workflowExecution = await executeWorkflows(
      {
        name: "opportunity.stage_changed",
        payload: {
          id: opp.id,
          stage: opp.stage,
          amount: Number(opp.amount) || 0,
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
  }

  // Mutate Lead status
  await dbStore.leads.update(id, {
    status: "Converted",
    convertedAccountId: account.id,
    convertedContactId: contact.id,
  });

  // Log audit logs
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Lead",
    action: "update",
    userId: tenant.userId,
    changes: {
      status: { before: lead.status, after: "Converted" },
    },
  });

  // Trigger Webhook
  triggerOutboundWebhooks(tenant.orgId, "lead.converted", {
    leadId: id,
    accountId: account.id,
    contactId: contact.id,
    opportunityId,
  });

  return c.json({
    success: true,
    accountId: account.id,
    contactId: contact.id,
    opportunityId,
    workflow: workflowExecution,
  });
});

// Accounts & Contacts REST API Endpoints
app.get("/api/accounts", tenantAuth, async (c) => {
  const accounts = await dbStore.accounts.findMany();
  return c.json({ success: true, data: accounts });
});

app.post("/api/accounts", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, domain, custom, parentAccountId } = body;

  if (!name) {
    return c.json({ error: "Missing required parameter: name" }, 400);
  }

  // Validate picklist dependencies
  const pldValidation = await enforcePicklistDependencies("accounts", {
    ...body,
    ...(custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  // Validate custom validation rules
  const customValValidation = await enforceCustomValidationRules("accounts", {
    ...body,
    ...(custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  if (parentAccountId) {
    const parent = await dbStore.accounts.findOne(parentAccountId);
    if (!parent) {
      return c.json({ error: "Parent account not found" }, 400);
    }
  }

  const account = await dbStore.accounts.insert({
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    name,
    domain: domain || null,
    custom: custom || null,
    parentAccountId: parentAccountId || null,
  });

  // Log audit trail
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: account.id,
    recordType: "accounts",
    action: "create",
    userId: tenant.userId,
    changes: {
      account: { before: null, after: account },
    },
  });

  return c.json({ success: true, data: account }, 201);
});

app.get("/api/accounts/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  return c.json({ success: true, data: account });
});

app.patch("/api/accounts/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const existing = await dbStore.accounts.findOne(id);
  if (!existing) {
    return c.json({ error: "Account not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));

  // Validate picklist dependencies
  const combinedForValidation = {
    ...existing,
    ...body,
    custom: {
      ...(existing.custom || {}),
      ...(body.custom || {}),
    },
  };
  const pldValidation = await enforcePicklistDependencies("accounts", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  // Validate custom validation rules
  const customValValidation = await enforceCustomValidationRules("accounts", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  const updates: Partial<Omit<typeof existing, "id" | "orgId" | "ownerId">> =
    {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.domain !== undefined) updates.domain = body.domain;
  if (body.custom !== undefined) updates.custom = body.custom;

  if (body.parentAccountId !== undefined) {
    const parentId = body.parentAccountId;
    if (parentId !== null) {
      // 1. Verify parent account exists and belongs to the same tenant context
      const parent = await dbStore.accounts.findOne(parentId);
      if (!parent) {
        return c.json({ error: "Parent account not found" }, 400);
      }

      // 2. Prevent circular reference
      const allAccounts = await dbStore.accounts.findMany();
      const hasCycle = detectCircularAccountRelation(allAccounts, id, parentId);
      if (hasCycle) {
        return c.json(
          {
            error: "Setting this parent account creates a circular reference.",
          },
          400,
        );
      }
    }
    updates.parentAccountId = parentId;
  }

  const updated = await dbStore.accounts.update(id, updates);

  // Log audit logs if parent changed
  if (
    body.parentAccountId !== undefined &&
    existing.parentAccountId !== updates.parentAccountId
  ) {
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "accounts",
      action: "update_hierarchy",
      userId: tenant.userId,
      changes: {
        parentAccountId: {
          before: existing.parentAccountId,
          after: updates.parentAccountId || null,
        },
      },
    });

    // Trigger Outbound Webhook
    triggerOutboundWebhooks(tenant.orgId, "account.hierarchy_updated", {
      accountId: id,
      oldParentId: existing.parentAccountId,
      newParentId: updates.parentAccountId || null,
    });
  } else {
    // Standard update log
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "accounts",
      action: "update",
      userId: tenant.userId,
      changes: {
        account: { before: existing, after: updated },
      },
    });
  }

  return c.json({ success: true, data: updated });
});

app.get("/api/accounts/:id/duplicates", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const sourceAccount = await dbStore.accounts.findOne(id);
  if (!sourceAccount) {
    return c.json({ error: "Account not found" }, 404);
  }
  const allAccounts = await dbStore.accounts.findMany();
  const duplicates = calculateAccountDuplicates(sourceAccount, allAccounts);
  return c.json({ success: true, data: duplicates });
});

app.post("/api/accounts/:id/merge", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { duplicateId, fieldResolution } = body;

  if (!duplicateId || !fieldResolution) {
    return c.json(
      { error: "Missing duplicateId or fieldResolution parameters" },
      400,
    );
  }

  const master = await dbStore.accounts.findOne(id);
  const duplicate = await dbStore.accounts.findOne(duplicateId);

  if (!master || !duplicate) {
    return c.json({ error: "Master or duplicate account not found" }, 404);
  }

  if (master.orgId !== tenant.orgId || duplicate.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  // Perform core merge logic
  const mergedAccount = mergeAccounts({ master, duplicate, fieldResolution });

  // Update master account
  const updatedMaster = await dbStore.accounts.update(id, {
    name: mergedAccount.name,
    domain: mergedAccount.domain,
    custom: mergedAccount.custom,
  });

  if (!updatedMaster) {
    return c.json({ error: "Failed to update master account" }, 500);
  }

  // Consolidate Contacts
  for (const contact of store.contacts) {
    if (contact.orgId === tenant.orgId && contact.accountId === duplicateId) {
      contact.accountId = id;
    }
  }

  // Consolidate Opportunities
  for (const opp of store.opportunities) {
    if (opp.orgId === tenant.orgId && opp.accountId === duplicateId) {
      opp.accountId = id;
    }
  }

  // Consolidate Contracts
  for (const contract of store.contracts) {
    if (contract.orgId === tenant.orgId && contract.accountId === duplicateId) {
      contract.accountId = id;
    }
  }

  // Consolidate activity links
  for (const link of store.activityLinks) {
    if (
      link.orgId === tenant.orgId &&
      link.targetType === "Account" &&
      link.targetId === duplicateId
    ) {
      link.targetId = id;
    }
  }

  // Consolidate Account Team members
  const duplicateTeamMembers = store.accountTeams.filter(
    (m) => m.orgId === tenant.orgId && m.accountId === duplicateId,
  );

  for (const dupMember of duplicateTeamMembers) {
    const masterAlreadyHasUser = store.accountTeams.some(
      (m) =>
        m.orgId === tenant.orgId &&
        m.accountId === id &&
        m.userId === dupMember.userId,
    );
    if (masterAlreadyHasUser) {
      // Remove duplicate team member
      const idx = store.accountTeams.findIndex((m) => m.id === dupMember.id);
      if (idx !== -1) {
        store.accountTeams.splice(idx, 1);
      }
    } else {
      // Update accountId to master ID
      dupMember.accountId = id;
    }
  }

  // Delete duplicate account
  await dbStore.accounts.delete(duplicateId);

  // Log audit log for master account update
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "accounts",
    action: "update",
    userId: tenant.userId,
    changes: {
      merge: { before: duplicateId, after: "merged_into_master" },
    },
  });

  // Trigger outbound webhook account.merged
  await triggerOutboundWebhooks(tenant.orgId, "account.merged", {
    accountId: id,
    mergedAccountId: duplicateId,
    finalAccount: updatedMaster,
  });

  return c.json({ success: true, data: updatedMaster });
});

app.get("/api/accounts/:id/hierarchy", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const parentPath = await dbStore.accounts.findParentPath(id);
  const children = await dbStore.accounts.findChildren(id);

  return c.json({
    success: true,
    data: {
      parentPath,
      children,
    },
  });
});

app.get("/api/accounts/:id/consolidated-pipeline", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const allAccounts = await dbStore.accounts.findMany();
  const allOpps = await dbStore.opportunities.findMany();

  const rollup = rollupHierarchyPipeline(allAccounts, allOpps, id);

  return c.json({
    success: true,
    data: rollup,
  });
});

app.get("/api/accounts/:id/team", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  const team = await dbStore.accountTeams.findForAccount(id);
  return c.json({ success: true, data: team });
});

app.post("/api/accounts/:id/team", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const userId = body.userId;
  const role = body.role;

  const validation = validateAccountTeamMember(id, userId, role);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const team = await dbStore.accountTeams.findForAccount(id);
  const priorMember = team.find((t) => t.userId === userId);
  const action = priorMember
    ? "account_team_member_updated"
    : "account_team_member_added";

  const updatedMember = await dbStore.accountTeams.addOrUpdateMember(
    id,
    userId,
    role,
  );

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "accounts",
    action,
    userId: tenant.userId,
    changes: {
      teamMember: { before: priorMember || null, after: updatedMember },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "account.team_updated", {
    accountId: id,
    userId,
    role,
    action,
  });

  return c.json(
    { success: true, data: updatedMember },
    priorMember ? 200 : 201,
  );
});

app.delete("/api/accounts/:id/team/:userId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const userId = c.req.param("userId");

  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const team = await dbStore.accountTeams.findForAccount(id);
  const priorMember = team.find((t) => t.userId === userId);
  if (!priorMember) {
    return c.json({ error: "Team member not found on this account" }, 404);
  }

  await dbStore.accountTeams.removeMember(id, userId);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "accounts",
    action: "account_team_member_removed",
    userId: tenant.userId,
    changes: {
      teamMember: { before: priorMember, after: null },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "account.team_updated", {
    accountId: id,
    userId,
    role: priorMember.role,
    action: "account_team_member_removed",
  });

  return c.json({ success: true });
});

app.get("/api/contacts", tenantAuth, async (c) => {
  const contacts = await dbStore.contacts.findMany();
  return c.json({ success: true, data: contacts });
});

app.get("/api/contacts/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const contact = await dbStore.contacts.findOne(id);
  if (!contact) {
    return c.json({ error: "Contact not found" }, 404);
  }
  return c.json({ success: true, data: contact });
});

app.post("/api/contacts", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { accountId, firstName, lastName, email, custom, reportsToId } = body;

  if (!lastName) {
    return c.json({ error: "Missing required parameter: lastName" }, 400);
  }

  // Validate picklist dependencies
  const pldValidation = await enforcePicklistDependencies("contacts", {
    ...body,
    ...(custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  // Validate custom validation rules
  const customValValidation = await enforceCustomValidationRules("contacts", {
    ...body,
    ...(custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  if (reportsToId) {
    const manager = await dbStore.contacts.findOne(reportsToId);
    if (!manager) {
      return c.json({ error: "Manager contact not found" }, 400);
    }
  }

  const contact = await dbStore.contacts.insert({
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    accountId: accountId || null,
    firstName: firstName || null,
    lastName,
    email: email || null,
    custom: custom || null,
    reportsToId: reportsToId || null,
  });

  // Log audit trail
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: contact.id,
    recordType: "contacts",
    action: "create",
    userId: tenant.userId,
    changes: {
      contact: { before: null, after: contact },
    },
  });

  return c.json({ success: true, data: contact }, 201);
});

app.patch("/api/contacts/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const existing = await dbStore.contacts.findOne(id);
  if (!existing) {
    return c.json({ error: "Contact not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));

  // Validate picklist dependencies
  const combinedForValidation = {
    ...existing,
    ...body,
    custom: {
      ...(existing.custom || {}),
      ...(body.custom || {}),
    },
  };
  const pldValidation = await enforcePicklistDependencies("contacts", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  // Validate custom validation rules
  const customValValidation = await enforceCustomValidationRules("contacts", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  const updates: Partial<Omit<typeof existing, "id" | "orgId" | "ownerId">> =
    {};

  if (body.accountId !== undefined) updates.accountId = body.accountId;
  if (body.firstName !== undefined) updates.firstName = body.firstName;
  if (body.lastName !== undefined) updates.lastName = body.lastName;
  if (body.email !== undefined) updates.email = body.email;
  if (body.custom !== undefined) updates.custom = body.custom;

  if (body.reportsToId !== undefined) {
    const reportsToId = body.reportsToId;
    if (reportsToId !== null) {
      // 1. Verify manager exists and belongs to the same tenant
      const manager = await dbStore.contacts.findOne(reportsToId);
      if (!manager) {
        return c.json({ error: "Manager contact not found" }, 400);
      }

      // 2. Prevent circular reference
      const allContacts = await dbStore.contacts.findMany();
      const hasCycle = detectCircularContactRelation(
        allContacts,
        id,
        reportsToId,
      );
      if (hasCycle) {
        return c.json(
          {
            error:
              "Setting this manager creates a circular reporting relationship.",
          },
          400,
        );
      }
    }
    updates.reportsToId = reportsToId;
  }

  const updated = await dbStore.contacts.update(id, updates);

  // Log audit logs if manager changed
  if (
    body.reportsToId !== undefined &&
    existing.reportsToId !== updates.reportsToId
  ) {
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "contacts",
      action: "update_hierarchy",
      userId: tenant.userId,
      changes: {
        reportsToId: {
          before: existing.reportsToId,
          after: updates.reportsToId || null,
        },
      },
    });

    // Trigger Outbound Webhook
    triggerOutboundWebhooks(tenant.orgId, "contact.hierarchy_updated", {
      contactId: id,
      oldReportsToId: existing.reportsToId,
      newReportsToId: updates.reportsToId || null,
    });
  } else {
    // Standard update logging
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "contacts",
      action: "update",
      userId: tenant.userId,
      changes: {
        contact: { before: existing, after: updated },
      },
    });
  }

  return c.json({ success: true, data: updated });
});

app.get("/api/contacts/:id/duplicates", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const sourceContact = await dbStore.contacts.findOne(id);
  if (!sourceContact) {
    return c.json({ error: "Contact not found" }, 404);
  }

  if (sourceContact.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const allContacts = await dbStore.contacts.findMany();
  const duplicates = calculateContactDuplicates(sourceContact, allContacts);
  return c.json({ success: true, data: duplicates });
});

app.post("/api/contacts/:id/merge", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { duplicateId, fieldResolution } = body;

  if (!duplicateId || !fieldResolution) {
    return c.json(
      { error: "Missing duplicateId or fieldResolution parameters" },
      400,
    );
  }

  const master = await dbStore.contacts.findOne(id);
  const duplicate = await dbStore.contacts.findOne(duplicateId);

  if (!master || !duplicate) {
    return c.json({ error: "Master or duplicate contact not found" }, 404);
  }

  if (master.orgId !== tenant.orgId || duplicate.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  // Perform core merge logic
  const mergedContact = mergeContacts({ master, duplicate, fieldResolution });

  // Update master contact
  const updatedMaster = await dbStore.contacts.update(id, {
    firstName: mergedContact.firstName,
    lastName: mergedContact.lastName,
    email: mergedContact.email,
    accountId: mergedContact.accountId,
    reportsToId: mergedContact.reportsToId,
    custom: mergedContact.custom,
  });

  if (!updatedMaster) {
    return c.json({ error: "Failed to update master contact" }, 500);
  }

  // Consolidate Tickets
  for (const ticket of store.tickets) {
    if (ticket.orgId === tenant.orgId && ticket.contactId === duplicateId) {
      ticket.contactId = id;
    }
  }

  // Consolidate Campaign Members
  const duplicateCampaignMembers = store.campaignMembers.filter(
    (m) => m.orgId === tenant.orgId && m.contactId === duplicateId,
  );

  for (const dupMember of duplicateCampaignMembers) {
    const masterAlreadyHasCampaign = store.campaignMembers.some(
      (m) =>
        m.orgId === tenant.orgId &&
        m.contactId === id &&
        m.campaignId === dupMember.campaignId,
    );
    if (masterAlreadyHasCampaign) {
      // Remove duplicate campaign member
      const idx = store.campaignMembers.findIndex((m) => m.id === dupMember.id);
      if (idx !== -1) {
        store.campaignMembers.splice(idx, 1);
      }
    } else {
      dupMember.contactId = id;
    }
  }

  // Consolidate Opportunity Contact Roles
  const duplicateContactRoles = store.opportunityContactRoles.filter(
    (r) => r.orgId === tenant.orgId && r.contactId === duplicateId,
  );

  for (const dupRole of duplicateContactRoles) {
    const masterAlreadyHasRoleOnOpp = store.opportunityContactRoles.some(
      (r) =>
        r.orgId === tenant.orgId &&
        r.contactId === id &&
        r.opportunityId === dupRole.opportunityId,
    );
    if (masterAlreadyHasRoleOnOpp) {
      // Remove duplicate contact role
      const idx = store.opportunityContactRoles.findIndex(
        (r) => r.id === dupRole.id,
      );
      if (idx !== -1) {
        store.opportunityContactRoles.splice(idx, 1);
      }
    } else {
      dupRole.contactId = id;
    }
  }

  // Consolidate activity links
  for (const link of store.activityLinks) {
    if (
      link.orgId === tenant.orgId &&
      link.targetType === "Contact" &&
      link.targetId === duplicateId
    ) {
      link.targetId = id;
    }
  }

  // Update contacts reporting to duplicate manager
  for (const cRecord of store.contacts) {
    if (cRecord.orgId === tenant.orgId && cRecord.reportsToId === duplicateId) {
      cRecord.reportsToId = id;
    }
  }

  // Delete duplicate contact
  await dbStore.contacts.delete(duplicateId);

  // Log audit log for master contact update
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "contacts",
    action: "update",
    userId: tenant.userId,
    changes: {
      merge: { before: duplicateId, after: "merged_into_master" },
    },
  });

  // Trigger outbound webhook contact.merged
  await triggerOutboundWebhooks(tenant.orgId, "contact.merged", {
    contactId: id,
    mergedContactId: duplicateId,
    finalContact: updatedMaster,
  });

  return c.json({ success: true, data: updatedMaster });
});

app.get("/api/contacts/:id/hierarchy", tenantAuth, async (c) => {
  const id = c.req.param("id");

  const contact = await dbStore.contacts.findOne(id);
  if (!contact) {
    return c.json({ error: "Contact not found" }, 404);
  }

  const parentPath = await dbStore.contacts.findParentPath(id);
  const directReports = await dbStore.contacts.findDirectReports(id);

  return c.json({
    success: true,
    data: {
      contact,
      parentPath,
      directReports,
    },
  });
});

// Opportunities Pipeline & Stage Management REST API Endpoints
app.get("/api/opportunities", tenantAuth, async (c) => {
  const opportunities = await dbStore.opportunities.findMany();
  return c.json({ success: true, data: opportunities });
});

app.get("/api/opportunities/kanban", tenantAuth, async (c) => {
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

app.post("/api/opportunities/kanban/transition", tenantAuth, async (c) => {
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
  triggerOutboundWebhooks(updated.orgId, "opportunity.stage_changed", {
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

app.get("/api/opportunities/stalled", tenantAuth, async (c) => {
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

app.get("/api/opportunities/stalled/rules", tenantAuth, async (c) => {
  const rules = await dbStore.opportunityStageDurationRules.findMany();
  return c.json({ success: true, data: rules });
});

app.post("/api/opportunities/stalled/rules", tenantAuth, async (c) => {
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

app.get("/api/opportunities/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  return c.json({ success: true, data: opportunity });
});

app.post("/api/opportunities", tenantAuth, async (c) => {
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

app.patch("/api/opportunities/:id", tenantAuth, async (c) => {
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
    | undefined = undefined;

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
    triggerOutboundWebhooks(updated.orgId, "opportunity.stage_changed", {
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

app.get("/api/opportunities/:id/stage-history", tenantAuth, async (c) => {
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
app.post("/api/products", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, sku, description, isActive } = body;

  if (!name) {
    return c.json({ error: "Missing required product name" }, 400);
  }

  const product = await dbStore.products.insert({
    orgId: tenant.orgId,
    name,
    sku: sku || null,
    description: description || null,
    isActive: isActive !== undefined ? !!isActive : true,
  });

  return c.json({ success: true, data: product });
});

app.get("/api/products", tenantAuth, async (c) => {
  const products = await dbStore.products.findMany();
  return c.json({ success: true, data: products });
});

// Pricebook Catalog REST API Routes
app.post("/api/pricebooks", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, description, isActive, isStandard } = body;

  if (!name) {
    return c.json({ error: "Missing required pricebook name" }, 400);
  }

  const pricebook = await dbStore.pricebooks.insert({
    orgId: tenant.orgId,
    name,
    description: description || null,
    isActive: isActive !== undefined ? !!isActive : true,
    isStandard: isStandard !== undefined ? !!isStandard : false,
  });

  return c.json({ success: true, data: pricebook });
});

app.get("/api/pricebooks", tenantAuth, async (c) => {
  const pricebooks = await dbStore.pricebooks.findMany();
  return c.json({ success: true, data: pricebooks });
});

app.post("/api/pricebooks/entries", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { pricebookId, productId, unitPrice, isActive } = body;

  if (!pricebookId || !productId || unitPrice === undefined) {
    return c.json({ error: "Missing required pricebook entry fields" }, 400);
  }

  const product = await dbStore.products.findOne(productId);
  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  const pricebook = await dbStore.pricebooks.findOne(pricebookId);
  if (!pricebook) {
    return c.json({ error: "Pricebook not found" }, 404);
  }

  const entry = await dbStore.pricebookEntries.insert({
    orgId: tenant.orgId,
    pricebookId,
    productId,
    unitPrice: String(unitPrice),
    isActive: isActive !== undefined ? !!isActive : true,
  });

  return c.json({ success: true, data: entry });
});

// Opportunity Line Items REST API Routes with Automatic Amount Rollup
app.post("/api/opportunities/:oppId/products", tenantAuth, async (c) => {
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

app.get("/api/opportunities/:oppId/products", tenantAuth, async (c) => {
  const oppId = c.req.param("oppId");

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);

  return c.json({ success: true, data: oppLines });
});

app.patch(
  "/api/opportunities/:oppId/products/:lineItemId",
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

app.delete(
  "/api/opportunities/:oppId/products/:lineItemId",
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

// Quota Configuration REST API Route
app.post("/api/quotas", tenantAuth, async (c) => {
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

app.get("/api/quotas", tenantAuth, async (c) => {
  const quotas = await dbStore.quotas.findMany();
  return c.json({ success: true, data: quotas });
});

// Custom Stage Probabilities Configuration REST API Route
app.post("/api/forecasting/probabilities", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { stage, probability } = body;

  if (!stage || probability === undefined) {
    return c.json({ error: "Missing required probability fields" }, 400);
  }

  const val = Number.parseInt(probability);
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
      } catch (e) {
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
      } catch (e) {
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
app.post("/api/opportunities/:oppId/quote", tenantAuth, async (c) => {
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

app.get("/api/opportunities/:oppId/quote", tenantAuth, async (c) => {
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

// Outbound Email Logging Endpoints
app.post("/api/emails/log", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { from, to, cc, bcc, subject, body: emailBody, links } = body;

  // Validate standard RFC-compliant email inputs
  const validation = validateEmailLogInput({
    from,
    to,
    cc: cc || [],
    bcc: bcc || [],
    subject: subject || "",
    body: emailBody || "",
  });

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  // Verify that all linked entities exist and belong to the active tenant
  if (links && Array.isArray(links)) {
    for (const link of links) {
      const { targetType, targetId } = link;
      let exists = false;
      if (targetType === "Account") {
        const found = await dbStore.accounts.findOne(targetId);
        if (found) exists = true;
      } else if (targetType === "Contact") {
        const found = await dbStore.contacts.findOne(targetId);
        if (found) exists = true;
      } else if (targetType === "Lead") {
        const found = await dbStore.leads.findOne(targetId);
        if (found) exists = true;
      } else if (targetType === "Opportunity") {
        const found = await dbStore.opportunities.findOne(targetId);
        if (found) exists = true;
      }

      if (!exists) {
        return c.json(
          {
            error: `Linked target not found or tenant mismatched: ${targetType} (${targetId})`,
          },
          400,
        );
      }
    }
  }

  // Insert a new activity record of type: "email"
  const newActivity = await dbStore.activities.insert({
    orgId: tenant.orgId,
    creatorId: tenant.userId,
    type: "email",
    subject,
    body: emailBody,
    dueDate: null,
    custom: { from, to, cc: cc || [], bcc: bcc || [] },
  });

  // Insert activity links if provided
  if (links && Array.isArray(links)) {
    for (const link of links) {
      await dbStore.activityLinks.insert({
        orgId: tenant.orgId,
        activityId: newActivity.id,
        targetType: link.targetType,
        targetId: link.targetId,
      });
    }
  }

  // Log audit trail
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newActivity.id,
    recordType: "EmailLog",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: newActivity });
});

app.get("/api/emails/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const activity = await dbStore.activities.findOne(id);

  if (!activity || activity.type !== "email") {
    return c.json({ error: "Email log not found" }, 404);
  }

  // Get associated links
  const allLinks = await dbStore.activityLinks.findMany();
  const linked = allLinks.filter((link) => link.activityId === id);

  return c.json({
    success: true,
    data: {
      ...activity,
      links: linked,
    },
  });
});

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

// Opportunity Approval Endpoints

app.post("/api/opportunities/:id/submit-approval", tenantAuth, async (c) => {
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

app.post("/api/approvals/:id/decide", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { status, comments } = body;

  if (status !== "Approved" && status !== "Rejected") {
    return c.json(
      { error: "Invalid status decision. Must be 'Approved' or 'Rejected'." },
      400,
    );
  }

  // Find the approval step under RLS context
  const step = await dbStore.opportunityApprovalSteps.findOne(id);
  if (!step) {
    return c.json({ error: "Approval step not found" }, 404);
  }

  if (step.status !== "Pending") {
    return c.json({ error: "Approval step has already been decided" }, 400);
  }

  // Validate the approver's role matches exactly
  if (tenant.roleId !== step.approverRoleId) {
    return c.json(
      {
        error:
          "Forbidden: You do not have the required role to decide this step",
      },
      403,
    );
  }

  // Update step status
  const updatedStep = await dbStore.opportunityApprovalSteps.update(id, {
    status,
    decidedByUserId: tenant.userId,
    comments: comments || null,
    decidedAt: new Date(),
  });

  // Load the main approval record
  const approval = await dbStore.opportunityApprovals.findOne(step.approvalId);
  if (!approval) {
    return c.json({ error: "Approval record not found" }, 404);
  }

  // Load all steps for this approval
  const allSteps = await dbStore.opportunityApprovalSteps.findMany();
  const approvalSteps = allSteps.filter(
    (s) => s.approvalId === step.approvalId,
  );

  let newApprovalStatus = "Pending";
  if (status === "Rejected") {
    newApprovalStatus = "Rejected";
  } else {
    // Check if all steps are approved
    const allApproved = approvalSteps.every((s) => {
      if (s.id === id) return true; // Already approved by this request
      return s.status === "Approved";
    });
    if (allApproved) {
      newApprovalStatus = "Approved";
    }
  }

  let updatedApproval = approval;
  if (newApprovalStatus !== "Pending") {
    updatedApproval =
      (await dbStore.opportunityApprovals.update(step.approvalId, {
        status: newApprovalStatus,
      })) || approval;

    // Auto transition opportunity stage
    const opportunity = await dbStore.opportunities.findOne(
      approval.opportunityId,
    );
    if (opportunity) {
      const nextStage =
        newApprovalStatus === "Approved" ? "Closed Won" : "Closed Lost";
      await dbStore.opportunities.update(opportunity.id, { stage: nextStage });

      await dbStore.opportunityStageHistory.insert({
        orgId: tenant.orgId,
        opportunityId: opportunity.id,
        fromStage: opportunity.stage,
        toStage: nextStage,
        amount: opportunity.amount,
        changedById: tenant.userId,
      });

      // Log opportunity audit log for automatic stage conversion
      await dbStore.auditLogs.insert({
        orgId: tenant.orgId,
        recordId: opportunity.id,
        recordType: "Opportunity",
        action: "update",
        userId: tenant.userId,
        changes: {
          stage: { before: opportunity.stage, after: nextStage },
        },
      });
    }
  }

  // Log step audit log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: step.id,
    recordType: "OpportunityApprovalStep",
    action: "decide",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({
    success: true,
    data: {
      approval: updatedApproval,
      step: updatedStep,
    },
  });
});

app.get("/api/opportunities/:id/approvals", tenantAuth, async (c) => {
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

app.post("/api/commissions/calculate", tenantAuth, async (c) => {
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
    } catch (_) {}
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

app.get("/api/commissions", tenantAuth, async (c) => {
  const list = await dbStore.commissions.findMany();
  return c.json({ success: true, data: list });
});

app.post("/api/commissions/:id/approve", tenantAuth, async (c) => {
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
app.post("/api/territories", tenantAuth, async (c) => {
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

app.put("/api/territories/:id", tenantAuth, async (c) => {
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

app.get("/api/territories", tenantAuth, async (c) => {
  const data = await dbStore.territories.findMany();
  return c.json({ success: true, data });
});

app.post("/api/territories/:id/members", tenantAuth, async (c) => {
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

app.delete("/api/territories/:id/members/:userId", tenantAuth, async (c) => {
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

app.get("/api/opportunities/:id/splits", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const splits = await dbStore.opportunitySplits.findForOpportunity(id);
  return c.json({ success: true, data: splits });
});

app.post("/api/opportunities/:id/splits", tenantAuth, async (c) => {
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

app.delete("/api/opportunities/:id/splits", tenantAuth, async (c) => {
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

// Campaigns & Campaign Members Endpoints
app.post("/api/campaigns", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    status,
    type,
    isActive,
    startDate,
    endDate,
    budgetedCost,
    actualCost,
    expectedRevenue,
  } = body;

  if (!name) {
    return c.json({ error: "Missing required parameter: name" }, 400);
  }

  const campaign = await dbStore.campaigns.insert({
    orgId: tenant.orgId,
    name,
    status: status || "Planned",
    type: type || "Other",
    isActive: isActive !== undefined ? Number(isActive) : 1,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    budgetedCost: budgetedCost || "0.00",
    actualCost: actualCost || "0.00",
    expectedRevenue: expectedRevenue || "0.00",
  });

  return c.json({ success: true, data: campaign });
});

app.get("/api/campaigns", tenantAuth, async (c) => {
  const campaignsList = await dbStore.campaigns.findMany();
  return c.json({ success: true, data: campaignsList });
});

app.get("/api/campaigns/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const campaign = await dbStore.campaigns.findOne(id);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  // Fetch campaign members
  const members = await dbStore.campaignMembers.findForCampaign(campaign.id);

  // Fetch opportunities and filter for campaignId
  const allOpps = await dbStore.opportunities.findMany();
  const opportunities = allOpps.filter((opp) => opp.campaignId === campaign.id);

  // Calculate statistics
  const stats = calculateCampaignStats({
    budgetedCost: campaign.budgetedCost,
    actualCost: campaign.actualCost,
    expectedRevenue: campaign.expectedRevenue,
    members,
    opportunities,
  });

  return c.json({
    success: true,
    data: {
      ...campaign,
      stats,
    },
  });
});

app.post("/api/campaigns/:id/members", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const campaignId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { leadId, contactId, status } = body;

  const campaign = await dbStore.campaigns.findOne(campaignId);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  if (!leadId && !contactId) {
    return c.json({ error: "Must provide either leadId or contactId" }, 400);
  }

  if (leadId && contactId) {
    return c.json({ error: "Cannot provide both leadId and contactId" }, 400);
  }

  // Verify lead or contact exists and belongs to the tenant
  if (leadId) {
    const lead = await dbStore.leads.findOne(leadId);
    if (!lead) {
      return c.json({ error: "Lead not found or tenant mismatch" }, 404);
    }
  }

  if (contactId) {
    const contact = await dbStore.contacts.findOne(contactId);
    if (!contact) {
      return c.json({ error: "Contact not found or tenant mismatch" }, 404);
    }
  }

  try {
    const member = await dbStore.campaignMembers.insert({
      orgId: tenant.orgId,
      campaignId,
      leadId: leadId || null,
      contactId: contactId || null,
      status: status || "Sent",
    });
    return c.json({ success: true, data: member });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

app.get("/api/campaigns/:id/members", tenantAuth, async (c) => {
  const campaignId = c.req.param("id");
  const campaign = await dbStore.campaigns.findOne(campaignId);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const members = await dbStore.campaignMembers.findForCampaign(campaignId);
  return c.json({ success: true, data: members });
});

app.post(
  "/api/campaigns/:id/members/:memberId/status",
  tenantAuth,
  async (c) => {
    const campaignId = c.req.param("id");
    const memberId = c.req.param("memberId");
    const body = await c.req.json().catch(() => ({}));
    const { status } = body;

    if (!status) {
      return c.json({ error: "Missing required parameter: status" }, 400);
    }

    const campaign = await dbStore.campaigns.findOne(campaignId);
    if (!campaign) {
      return c.json({ error: "Campaign not found" }, 404);
    }

    const member = await dbStore.campaignMembers.findOne(memberId);
    if (!member || member.campaignId !== campaignId) {
      return c.json({ error: "Campaign member not found" }, 404);
    }

    const updated = await dbStore.campaignMembers.update(memberId, { status });
    return c.json({ success: true, data: updated });
  },
);

app.post("/api/campaigns/:id/email-blast", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const campaignId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { templateId, senderEmail } = body;

  if (!templateId) {
    return c.json({ error: "Missing required parameter: templateId" }, 400);
  }

  if (!senderEmail) {
    return c.json({ error: "Missing required parameter: senderEmail" }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(senderEmail)) {
    return c.json({ error: "Invalid 'senderEmail' format" }, 400);
  }

  const campaign = await dbStore.campaigns.findOne(campaignId);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const template = await dbStore.emailTemplates.findOne(templateId);
  if (!template) {
    return c.json({ error: "Email template not found" }, 404);
  }

  const members = await dbStore.campaignMembers.findForCampaign(campaignId);
  const emailLogs: unknown[] = [];
  let processedCount = 0;

  for (const member of members) {
    let targetEmail: string | null = null;
    const context: {
      lead?: Record<string, unknown>;
      contact?: Record<string, unknown>;
      account?: Record<string, unknown>;
      opportunity?: Record<string, unknown>;
    } = {};

    if (member.leadId) {
      const lead = await dbStore.leads.findOne(member.leadId);
      if (lead) {
        targetEmail = lead.email;
        context.lead = lead as unknown as Record<string, unknown>;
      }
    } else if (member.contactId) {
      const contact = await dbStore.contacts.findOne(member.contactId);
      if (contact) {
        targetEmail = contact.email;
        context.contact = contact as unknown as Record<string, unknown>;

        if (contact.accountId) {
          const account = await dbStore.accounts.findOne(contact.accountId);
          if (account) {
            context.account = account as unknown as Record<string, unknown>;

            // Fetch opportunities associated with the account, get the most recently updated/created one
            const allOpps = await dbStore.opportunities.findMany();
            const accountOpps = allOpps.filter(
              (opp) => opp.accountId === account.id,
            );
            if (accountOpps.length > 0) {
              const sorted = [...accountOpps].sort((a, b) => {
                const dateA = a.closeDate ? new Date(a.closeDate).getTime() : 0;
                const dateB = b.closeDate ? new Date(b.closeDate).getTime() : 0;
                return dateB - dateA;
              });
              context.opportunity = sorted[0] as unknown as Record<
                string,
                unknown
              >;
            }
          }
        }
      }
    }

    if (!targetEmail || !emailRegex.test(targetEmail)) {
      continue; // Skip members without valid emails
    }

    const compiled = compileEmailTemplate(
      { subject: template.subject, body: template.body },
      context,
    );

    const act = await dbStore.activities.insert({
      orgId: tenant.orgId,
      creatorId: tenant.userId,
      type: "email",
      subject: compiled.subject,
      body: compiled.body,
      dueDate: null,
      custom: {
        from: senderEmail,
        to: [targetEmail],
        cc: [],
        bcc: [],
      },
    });

    // Links: recipient
    await dbStore.activityLinks.insert({
      orgId: tenant.orgId,
      activityId: act.id,
      targetType: member.leadId ? "Lead" : "Contact",
      targetId: member.leadId ? member.leadId : member.contactId || "",
    });

    // Links: Campaign
    await dbStore.activityLinks.insert({
      orgId: tenant.orgId,
      activityId: act.id,
      targetType: "Campaign",
      targetId: campaignId,
    });

    // Links: Account
    if (context.account) {
      await dbStore.activityLinks.insert({
        orgId: tenant.orgId,
        activityId: act.id,
        targetType: "Account",
        targetId: context.account.id as string,
      });
    }

    // Links: Opportunity
    if (context.opportunity) {
      await dbStore.activityLinks.insert({
        orgId: tenant.orgId,
        activityId: act.id,
        targetType: "Opportunity",
        targetId: context.opportunity.id as string,
      });
    }

    // Update member status to Sent
    await dbStore.campaignMembers.update(member.id, { status: "Sent" });

    // Audit Log
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: act.id,
      recordType: "EmailLog",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });

    emailLogs.push(act);
    processedCount++;
  }

  return c.json({
    success: true,
    processedCount,
    emailLogs,
  });
});

app.get("/api/opportunities/:id/contact-roles", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const roles = await dbStore.opportunityContactRoles.findForOpportunity(id);
  return c.json({ success: true, data: roles });
});

app.post("/api/opportunities/:id/contact-roles", tenantAuth, async (c) => {
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

app.put(
  "/api/opportunities/:id/contact-roles/:roleId",
  tenantAuth,
  async (c) => {
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
  },
);

app.delete(
  "/api/opportunities/:id/contact-roles/:roleId",
  tenantAuth,
  async (c) => {
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
  },
);

// Campaign Influence Endpoints
app.get("/api/opportunities/:id/campaign-influence", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opp = await dbStore.opportunities.findOne(id);
  if (!opp) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const influences = await dbStore.campaignInfluence.findForOpportunity(id);
  return c.json({ success: true, data: influences });
});

app.post("/api/opportunities/:id/campaign-influence", tenantAuth, async (c) => {
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

  const pct = Number.parseInt(influencePercentage);
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

app.delete(
  "/api/opportunities/:id/campaign-influence/:influenceId",
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

app.get("/api/campaigns/:id/attribution", tenantAuth, async (c) => {
  const id = c.req.param("id");

  const influences = await dbStore.campaignInfluence.findMany();
  const campaignInfluences = influences.filter((inf) => inf.campaignId === id);

  let totalRevenue = 0;
  for (const inf of campaignInfluences) {
    const opp = await dbStore.opportunities.findOne(inf.opportunityId);
    if (opp && opp.stage === "Closed Won") {
      totalRevenue += Number.parseFloat(inf.revenueShare) || 0;
    }
  }

  return c.json({
    success: true,
    data: {
      totalRevenueAttributed: totalRevenue.toFixed(2),
    },
  });
});

app.get("/api/campaigns/:id/roi", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const campaign = await dbStore.campaigns.findOne(id);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const members = await dbStore.campaignMembers.findForCampaign(id);
  const influences = await dbStore.campaignInfluence.findMany();
  const campaignInfluences = influences.filter((inf) => inf.campaignId === id);

  const opportunities = await dbStore.opportunities.findMany();
  const wonOpportunityIds = new Set(
    opportunities
      .filter((opp) => opp.stage === "Closed Won")
      .map((opp) => opp.id),
  );

  const metrics = calculateCampaignROI({
    campaign,
    members,
    influences: campaignInfluences,
    wonOpportunityIds,
  });

  return c.json({
    success: true,
    data: metrics,
  });
});

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

app.get("/api/opportunities/:id/competitors", tenantAuth, async (c) => {
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

app.post("/api/opportunities/:id/competitors", tenantAuth, async (c) => {
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

app.put(
  "/api/opportunities/:id/competitors/:competitorId",
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

app.delete(
  "/api/opportunities/:id/competitors/:competitorId",
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

app.get("/api/opportunities/:id/team", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const team = await dbStore.opportunityTeams.findForOpportunity(id);
  return c.json({ success: true, data: team });
});

app.post("/api/opportunities/:id/team", tenantAuth, async (c) => {
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

app.delete("/api/opportunities/:id/team/:userId", tenantAuth, async (c) => {
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

// Opportunity Product Schedules (Revenue / Quantity Scheduling) Endpoints
app.get(
  "/api/opportunities/:id/products/:productId/schedules",
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

app.post(
  "/api/opportunities/:id/products/:productId/schedules",
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

app.delete(
  "/api/opportunities/:id/products/:productId/schedules/:scheduleId",
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

app.post(
  "/api/opportunities/:id/products/:productId/schedules/generate",
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
    const periodsCount = Number.parseInt(body.periodsCount) || 12;
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

app.get("/api/consent", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
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
  if (!settings || !settings.isActive) {
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

app.post("/api/service/sla-policies", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    priority,
    responseTimeLimitMinutes,
    resolutionTimeLimitMinutes,
  } = body;

  if (
    !name ||
    !priority ||
    responseTimeLimitMinutes === undefined ||
    resolutionTimeLimitMinutes === undefined
  ) {
    return c.json(
      {
        error:
          "Missing required fields: 'name', 'priority', 'responseTimeLimitMinutes', or 'resolutionTimeLimitMinutes'",
      },
      400,
    );
  }

  if (priority !== "high" && priority !== "medium" && priority !== "low") {
    return c.json(
      { error: "Invalid priority. Must be 'high', 'medium', or 'low'" },
      400,
    );
  }

  const newPolicy = await dbStore.slaPolicies.insert({
    orgId: tenant.orgId,
    name,
    priority: priority as "high" | "medium" | "low",
    responseTimeLimitMinutes: Number(responseTimeLimitMinutes),
    resolutionTimeLimitMinutes: Number(resolutionTimeLimitMinutes),
    isActive: true,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newPolicy.id,
    recordType: "sla_policies",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: name },
      priority: { before: null, after: priority },
    },
  });

  return c.json({ success: true, data: newPolicy }, 201);
});

app.get("/api/service/sla-policies", tenantAuth, async (c) => {
  const policies = await dbStore.slaPolicies.findMany();
  return c.json({ success: true, data: policies });
});

app.post("/api/service/tickets/:id/milestones", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ticketId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { priority } = body;

  if (!priority) {
    return c.json({ error: "Missing required field: 'priority'" }, 400);
  }

  if (priority !== "high" && priority !== "medium" && priority !== "low") {
    return c.json(
      { error: "Invalid priority. Must be 'high', 'medium', or 'low'" },
      400,
    );
  }

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  // Overwrite check
  const existing = await dbStore.ticketMilestones.findByTicket(ticketId);
  if (existing.length > 0) {
    return c.json(
      { error: "Ticket is already enrolled in an SLA policy" },
      400,
    );
  }

  const policies = await dbStore.slaPolicies.findMany();
  const matchedPolicy = policies.find(
    (p) => p.priority === priority && p.isActive,
  );

  if (!matchedPolicy) {
    return c.json(
      { error: `No active SLA Policy found for priority '${priority}'` },
      400,
    );
  }

  const firstResponseDueDate = calculateMilestoneDueDate(
    ticket.createdAt,
    matchedPolicy.responseTimeLimitMinutes,
  );
  const resolutionDueDate = calculateMilestoneDueDate(
    ticket.createdAt,
    matchedPolicy.resolutionTimeLimitMinutes,
  );

  const m1 = await dbStore.ticketMilestones.insert({
    orgId: tenant.orgId,
    ticketId,
    milestoneType: "first_response",
    targetTime: firstResponseDueDate,
    completedAt: null,
    status: "pending",
    isMet: null,
  });

  const m2 = await dbStore.ticketMilestones.insert({
    orgId: tenant.orgId,
    ticketId,
    milestoneType: "resolution",
    targetTime: resolutionDueDate,
    completedAt: null,
    status: "pending",
    isMet: null,
  });

  return c.json({ success: true, data: [m1, m2] }, 201);
});

app.get("/api/service/tickets/:id/milestones", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const milestones = await dbStore.ticketMilestones.findByTicket(ticketId);
  return c.json({ success: true, data: milestones });
});

app.put(
  "/api/service/tickets/:id/milestones/:milestoneId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const { milestoneId } = c.req.param();
    const body = await c.req.json().catch(() => ({}));
    const { action } = body;

    if (action !== "complete") {
      return c.json(
        { error: "Invalid action. Supported action: 'complete'" },
        400,
      );
    }

    const milestone = await dbStore.ticketMilestones.findOne(milestoneId);
    if (!milestone) {
      return c.json({ error: "Milestone not found" }, 404);
    }

    if (milestone.status !== "pending") {
      return c.json(
        { error: "Milestone is already completed or breached" },
        400,
      );
    }

    const now = new Date();
    const evaluation = evaluateMilestoneCompletion(milestone.targetTime, now);

    const updated = await dbStore.ticketMilestones.update(milestoneId, {
      completedAt: now,
      status: evaluation.status,
      isMet: evaluation.isMet,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: milestoneId,
      recordType: "ticket_milestones",
      action: "update",
      userId: tenant.userId,
      changes: {
        status: { before: "pending", after: evaluation.status },
        isMet: { before: null, after: evaluation.isMet },
      },
    });

    await triggerOutboundWebhooks(tenant.orgId, "service.milestone_updated", {
      milestoneId,
      ticketId: milestone.ticketId,
      status: evaluation.status,
      isMet: evaluation.isMet,
    });

    return c.json({ success: true, data: updated });
  },
);

app.post("/api/service/kb/categories", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return c.json({ error: "Missing or empty required field: 'name'" }, 400);
  }

  const newCategory = await dbStore.kbCategories.insert({
    orgId: tenant.orgId,
    name: name.trim(),
    description: description || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newCategory.id,
    recordType: "kb_categories",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: newCategory.name },
    },
  });

  return c.json({ success: true, data: newCategory }, 201);
});

app.get("/api/service/kb/categories", tenantAuth, async (c) => {
  const categories = await dbStore.kbCategories.findMany();
  return c.json({ success: true, data: categories });
});

app.post("/api/service/kb/articles", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { title, content, status, categoryId } = body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    return c.json({ error: "Missing or empty required field: 'title'" }, 400);
  }
  if (!content || typeof content !== "string" || content.trim() === "") {
    return c.json({ error: "Missing or empty required field: 'content'" }, 400);
  }
  if (!status || !validateArticleStatus(status)) {
    return c.json(
      { error: "Invalid status. Must be 'Draft' or 'Published'" },
      400,
    );
  }
  if (!categoryId) {
    return c.json({ error: "Missing required field: 'categoryId'" }, 400);
  }

  const category = await dbStore.kbCategories.findOne(categoryId);
  if (!category) {
    return c.json({ error: "Category not found" }, 404);
  }

  const newArticle = await dbStore.kbArticles.insert({
    orgId: tenant.orgId,
    categoryId,
    title: title.trim(),
    content: content.trim(),
    status: status as "Draft" | "Published",
    viewCount: 0,
    authorId: tenant.userId,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newArticle.id,
    recordType: "kb_articles",
    action: "create",
    userId: tenant.userId,
    changes: {
      title: { before: null, after: newArticle.title },
      status: { before: null, after: newArticle.status },
    },
  });

  return c.json({ success: true, data: newArticle }, 201);
});

app.get("/api/service/kb/articles", tenantAuth, async (c) => {
  const categoryId = c.req.query("categoryId");
  const status = c.req.query("status");

  let articles = await dbStore.kbArticles.findMany();

  if (categoryId) {
    articles = articles.filter((a) => a.categoryId === categoryId);
  }
  if (status) {
    articles = articles.filter((a) => a.status === status);
  }

  return c.json({ success: true, data: articles });
});

app.put("/api/service/kb/articles/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { title, content, status, categoryId } = body;

  const article = await dbStore.kbArticles.findOne(id);
  if (!article) {
    return c.json({ error: "Article not found" }, 404);
  }

  const updates: Record<string, unknown> = {};
  const changes: Record<string, { before: unknown; after: unknown }> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim() === "") {
      return c.json({ error: "Invalid title value" }, 400);
    }
    updates.title = title.trim();
    changes.title = { before: article.title, after: updates.title };
  }

  if (content !== undefined) {
    if (typeof content !== "string" || content.trim() === "") {
      return c.json({ error: "Invalid content value" }, 400);
    }
    updates.content = content.trim();
  }

  if (status !== undefined) {
    if (!validateArticleStatus(status)) {
      return c.json(
        { error: "Invalid status value. Must be 'Draft' or 'Published'" },
        400,
      );
    }
    updates.status = status;
    changes.status = { before: article.status, after: updates.status };
  }

  if (categoryId !== undefined) {
    const category = await dbStore.kbCategories.findOne(categoryId);
    if (!category) {
      return c.json({ error: "Category not found" }, 404);
    }
    updates.categoryId = categoryId;
    changes.categoryId = { before: article.categoryId, after: categoryId };
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No update fields provided" }, 400);
  }

  const updated = await dbStore.kbArticles.update(id, updates);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "kb_articles",
    action: "update",
    userId: tenant.userId,
    changes,
  });

  return c.json({ success: true, data: updated });
});

app.post("/api/service/kb/articles/:id/view", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const article = await dbStore.kbArticles.findOne(id);
  if (!article) {
    return c.json({ error: "Article not found" }, 404);
  }

  const newViewCount = incrementArticleViewCount(article.viewCount);
  const updated = await dbStore.kbArticles.update(id, {
    viewCount: newViewCount,
  });

  return c.json({ success: true, data: updated });
});

app.post("/api/service/tickets/:id/comments", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const tenant = c.get("tenant");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const body = await c.req.json();
  const validation = validateTicketCommentInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const comment = await dbStore.ticketComments.insert({
    orgId: tenant.orgId,
    ticketId,
    authorId: tenant.userId,
    body: body.body,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: comment.id,
    recordType: "ticket_comments",
    action: "create",
    userId: tenant.userId,
    changes: {
      body: { before: null, after: body.body },
    },
  });

  return c.json({ success: true, data: comment });
});

app.get("/api/service/tickets/:id/comments", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const allComments = await dbStore.ticketComments.findMany();
  const filtered = allComments
    .filter((c) => c.ticketId === ticketId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return c.json({ success: true, data: filtered });
});

app.post("/api/service/tags", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  const validation = validateTicketTagInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const existingTags = await dbStore.ticketTags.findMany();
  if (
    existingTags.some(
      (t) => t.name.toLowerCase() === body.name.trim().toLowerCase(),
    )
  ) {
    return c.json({ error: "Tag name already exists" }, 400);
  }

  const tag = await dbStore.ticketTags.insert({
    orgId: tenant.orgId,
    name: body.name.trim(),
    color: body.color,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: tag.id,
    recordType: "ticket_tags",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: tag.name },
      color: { before: null, after: tag.color },
    },
  });

  return c.json({ success: true, data: tag });
});

app.get("/api/service/tags", tenantAuth, async (c) => {
  const tags = await dbStore.ticketTags.findMany();
  return c.json({ success: true, data: tags });
});

app.post("/api/service/tickets/:id/tags", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const tenant = c.get("tenant");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const body = await c.req.json();
  const { tagId } = body;
  if (!tagId) {
    return c.json({ error: "tagId is required" }, 400);
  }

  const tag = await dbStore.ticketTags.findOne(tagId);
  if (!tag) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const existingLinks = await dbStore.ticketTagLinks.findMany();
  const alreadyLinked = existingLinks.find(
    (l) => l.ticketId === ticketId && l.tagId === tagId,
  );

  if (alreadyLinked) {
    return c.json({ success: true, data: alreadyLinked });
  }

  const link = await dbStore.ticketTagLinks.insert({
    orgId: tenant.orgId,
    ticketId,
    tagId,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: link.id,
    recordType: "ticket_tag_links",
    action: "create",
    userId: tenant.userId,
    changes: {
      ticketId: { before: null, after: ticketId },
      tagId: { before: null, after: tagId },
    },
  });

  return c.json({ success: true, data: link });
});

app.delete("/api/service/tickets/:id/tags/:tagId", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const tagId = c.req.param("tagId");
  const tenant = c.get("tenant");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const existingLinks = await dbStore.ticketTagLinks.findMany();
  const link = existingLinks.find(
    (l) => l.ticketId === ticketId && l.tagId === tagId,
  );

  if (!link) {
    return c.json({ error: "Tag link not found" }, 404);
  }

  await dbStore.ticketTagLinks.delete(link.id);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: link.id,
    recordType: "ticket_tag_links",
    action: "delete",
    userId: tenant.userId,
    changes: {
      ticketId: { before: ticketId, after: null },
      tagId: { before: tagId, after: null },
    },
  });

  return c.json({ success: true });
});

app.get("/api/service/tickets/:id/tags", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const allLinks = await dbStore.ticketTagLinks.findMany();
  const ticketLinks = allLinks.filter((l) => l.ticketId === ticketId);

  const allTags = await dbStore.ticketTags.findMany();
  const tags = ticketLinks
    .map((link) => allTags.find((t) => t.id === link.tagId))
    .filter(Boolean);

  return c.json({ success: true, data: tags });
});

app.post("/api/service/tickets/escalation-rules", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    triggerType,
    timeThresholdMinutes,
    escalateToId,
    newPriority,
    isActive,
  } = body;

  if (!name || !triggerType || !escalateToId) {
    return c.json(
      { error: "Missing required escalation rule parameters" },
      400,
    );
  }

  const activeVal = isActive !== undefined ? Number(isActive) : 1;

  const newRule = await dbStore.ticketEscalationRules.insert({
    orgId: tenant.orgId,
    name,
    triggerType,
    timeThresholdMinutes:
      timeThresholdMinutes !== undefined ? Number(timeThresholdMinutes) : 0,
    escalateToId,
    newPriority: newPriority || null,
    isActive: activeVal,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newRule.id,
    recordType: "ticket_escalation_rules",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: newRule }, 201);
});

app.get("/api/service/tickets/escalation-rules", tenantAuth, async (c) => {
  const rules = await dbStore.ticketEscalationRules.findMany();
  return c.json({ success: true, data: rules });
});

app.post("/api/service/tickets/:id/escalate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const rules = await dbStore.ticketEscalationRules.findMany();
  const activeRules = rules.filter((r) => r.isActive === 1);

  const allMilestones = await dbStore.ticketMilestones.findMany();
  const milestones = allMilestones.filter((m) => m.ticketId === ticketId);

  const coreMilestones = milestones.map((m) => ({
    id: m.id,
    milestoneType: m.milestoneType,
    targetTime: new Date(m.targetTime),
    status: m.status,
    completedAt: m.completedAt ? new Date(m.completedAt) : null,
  }));

  const coreRules = activeRules.map((r) => ({
    id: r.id,
    name: r.name,
    triggerType: r.triggerType,
    timeThresholdMinutes: r.timeThresholdMinutes,
    escalateToId: r.escalateToId,
    newPriority: r.newPriority,
    isActive: r.isActive,
  }));

  const escalationResult = evaluateTicketEscalation(
    {
      priority: ticket.priority || "Medium",
      assignedToId: ticket.assignedToId || null,
    },
    coreMilestones,
    coreRules,
  );

  if (!escalationResult) {
    return c.json({ success: true, escalated: false, data: ticket });
  }

  const previousAssignedToId = ticket.assignedToId || null;
  const previousPriority = ticket.priority || "Medium";
  const newPriority = escalationResult.newPriority || previousPriority;

  const updatedTicket = await dbStore.tickets.update(ticketId, {
    assignedToId: escalationResult.escalateToId,
    priority: newPriority,
  });

  const newEscalation = await dbStore.ticketEscalations.insert({
    orgId: tenant.orgId,
    ticketId,
    ruleId: escalationResult.ruleId,
    previousAssignedToId,
    escalatedToId: escalationResult.escalateToId,
    previousPriority,
    newPriority,
    reason: escalationResult.reason,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: ticketId,
    recordType: "Ticket",
    action: "escalate",
    userId: tenant.userId,
    changes: {
      assignedToId: {
        before: previousAssignedToId,
        after: escalationResult.escalateToId,
      },
      priority: { before: previousPriority, after: newPriority },
    },
  });

  return c.json({
    success: true,
    escalated: true,
    data: updatedTicket,
    escalation: newEscalation,
  });
});

app.get("/api/service/tickets/:id/escalations", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const escalations = await dbStore.ticketEscalations.findMany();
  const ticketEscalationsList = escalations.filter(
    (e) => e.ticketId === ticketId,
  );

  return c.json({ success: true, data: ticketEscalationsList });
});

app.post("/api/service/tickets/macros", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();

  const validation = validateTicketMacroInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const newMacro = await dbStore.ticketMacros.insert({
    orgId: tenant.orgId,
    name: body.name,
    description: body.description || null,
    cannedResponse: body.cannedResponse,
    updateStatus: body.updateStatus || null,
    updatePriority: body.updatePriority || null,
  });

  return c.json({ success: true, data: newMacro });
});

app.get("/api/service/tickets/macros", tenantAuth, async (c) => {
  const macros = await dbStore.ticketMacros.findMany();
  return c.json({ success: true, data: macros });
});

app.post(
  "/api/service/tickets/:id/apply-macro/:macroId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const ticketId = c.req.param("id");
    const macroId = c.req.param("macroId");

    const ticket = await dbStore.tickets.findOne(ticketId);
    if (!ticket) {
      return c.json({ error: "Ticket not found" }, 404);
    }

    const macro = await dbStore.ticketMacros.findOne(macroId);
    if (!macro) {
      return c.json({ error: "Macro not found" }, 404);
    }

    if (ticket.orgId !== tenant.orgId || macro.orgId !== tenant.orgId) {
      return c.json(
        { error: "RLS Isolation Violation: Tenant mismatch." },
        403,
      );
    }

    const result = applyTicketMacro({
      ticket: {
        id: ticket.id,
        orgId: ticket.orgId,
        status: ticket.status,
        priority: ticket.priority || "Medium",
      },
      macro: {
        id: macro.id,
        orgId: macro.orgId,
        name: macro.name,
        cannedResponse: macro.cannedResponse,
        updateStatus: macro.updateStatus,
        updatePriority: macro.updatePriority,
      },
    });

    const updatedTicket = await dbStore.tickets.update(ticketId, {
      status: result.updatedStatus as "Open" | "In Progress" | "Resolved",
      priority: result.updatedPriority as "Low" | "Medium" | "High" | "Urgent",
    });

    const newComment = await dbStore.ticketComments.insert({
      orgId: tenant.orgId,
      ticketId: ticketId,
      authorId: tenant.userId,
      body: result.commentBody,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: ticketId,
      recordType: "Ticket",
      action: "apply_macro",
      userId: tenant.userId,
      changes: {
        status: { before: ticket.status, after: result.updatedStatus },
        priority: {
          before: ticket.priority || "Medium",
          after: result.updatedPriority,
        },
        commentInserted: { before: null, after: newComment.id },
      },
    });

    return c.json({
      success: true,
      data: updatedTicket,
      comment: newComment,
      message: result.auditMessage,
    });
  },
);

app.post("/api/service/tickets/:id/feedback", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ticketId = c.req.param("id");
  const body = await c.req.json();

  const validation = validateCSATFeedbackInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  if (ticket.orgId !== tenant.orgId) {
    return c.json({ error: "RLS Isolation Violation: Tenant mismatch." }, 403);
  }

  let surveyId = body.surveyId;
  if (!surveyId) {
    const surveys = await dbStore.surveys.findMany();
    let survey = surveys.find(
      (s) => s.type === "csat" && s.status === "active",
    );
    if (!survey) {
      survey = await dbStore.surveys.insert({
        orgId: tenant.orgId,
        name: "Default Ticket CSAT Survey",
        type: "csat",
        status: "active",
      });
    }
    surveyId = survey.id;
  }

  const newResponse = await dbStore.surveyResponses.insert({
    orgId: tenant.orgId,
    surveyId: surveyId,
    contactId: ticket.contactId || null,
    ticketId: ticketId,
    score: body.score,
    comment: body.comment || null,
  });

  let updatedTicket = ticket;
  if (ticket.status !== "Resolved") {
    const res = await dbStore.tickets.update(ticketId, {
      status: "Resolved",
    });
    if (res) {
      updatedTicket = res;
    }
  }

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: ticketId,
    recordType: "Ticket",
    action: "submit_feedback",
    userId: tenant.userId,
    changes: {
      score: { before: null, after: body.score },
      comment: { before: null, after: body.comment || null },
      statusTransitioned: {
        before: ticket.status,
        after: updatedTicket.status,
      },
    },
  });

  return c.json({ success: true, data: newResponse, ticket: updatedTicket });
});

app.get("/api/service/tickets/:id/feedback", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  if (ticket.orgId !== tenant.orgId) {
    return c.json({ error: "RLS Isolation Violation: Tenant mismatch." }, 403);
  }

  const responses = await dbStore.surveyResponses.findByTicket(ticketId);
  return c.json({ success: true, data: responses });
});

app.get("/api/service/agents/:id/metrics", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const agentId = c.req.param("id");

  const allTickets = await dbStore.tickets.findMany();
  const agentTickets = allTickets.filter((t) => t.assignedToId === agentId);

  const allResponses = await dbStore.surveyResponses.findMany();
  const allMilestones = await dbStore.ticketMilestones.findMany();

  const ticketsWithResolvedAt = agentTickets.map((t) => {
    const ms = allMilestones.find(
      (m) =>
        m.ticketId === t.id &&
        m.milestoneType === "resolution" &&
        m.status === "completed",
    );
    return {
      id: t.id,
      assignedToId: t.assignedToId || null,
      status: t.status,
      createdAt: t.createdAt,
      resolvedAt: ms
        ? ms.completedAt
        : t.status === "Resolved"
          ? new Date()
          : null,
    };
  });

  const metrics = calculateAgentCSATMetrics({
    agentId,
    tickets: ticketsWithResolvedAt,
    responses: allResponses.map((r) => ({
      ticketId: r.ticketId ?? null,
      score: r.score,
    })),
  });

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
    } catch (e) {
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
app.post("/api/emails/:activityId/tracker", tenantAuth, async (c) => {
  const tenant = c.get("tenant") as {
    orgId: string;
    userId: string;
    roleId: string;
  };
  const { activityId } = c.req.param();

  const activity = await dbStore.activities.findOne(activityId);
  if (!activity) {
    return c.json({ success: false, error: "Email activity not found" }, 404);
  }

  // Generate unique token
  const token = `tr-${Math.random().toString(36).substring(2, 11)}${Math.random().toString(36).substring(2, 11)}`;

  const tracker = await dbStore.emailTrackers.insert({
    orgId: tenant.orgId,
    activityId,
    token,
  });

  return c.json({ success: true, tracker });
});

app.get("/api/emails/:activityId/tracker", tenantAuth, async (c) => {
  const tenant = c.get("tenant") as {
    orgId: string;
    userId: string;
    roleId: string;
  };
  const { activityId } = c.req.param();

  const trackers = await dbStore.emailTrackers.findMany();
  const tracker = trackers.find(
    (t) => t.activityId === activityId && t.orgId === tenant.orgId,
  );

  if (!tracker) {
    return c.json({ success: false, error: "Tracker not found" }, 404);
  }

  return c.json({ success: true, tracker });
});

app.get("/api/emails/trackers/:trackerId/clicks", tenantAuth, async (c) => {
  const tenant = c.get("tenant") as {
    orgId: string;
    userId: string;
    roleId: string;
  };
  const { trackerId } = c.req.param();

  const tracker = await dbStore.emailTrackers.findOne(trackerId);
  if (!tracker || tracker.orgId !== tenant.orgId) {
    return c.json(
      { success: false, error: "Tracker not found or unauthorized" },
      404,
    );
  }

  const clicks = await dbStore.emailClickEvents.findForTracker(trackerId);
  clicks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return c.json({ success: true, clicks });
});

app.get("/api/public/emails/track/open/:token", async (c) => {
  const { token } = c.req.param();
  const ipAddress =
    c.req.header("x-forwarded-for") ||
    c.req.header("cf-connecting-ip") ||
    "127.0.0.1";
  const userAgent = c.req.header("user-agent") || "Unknown";

  let deviceType = "desktop";
  if (userAgent) {
    const ua = userAgent.toLowerCase();
    if (ua.includes("ipad") || ua.includes("tablet")) {
      deviceType = "tablet";
    } else if (
      ua.includes("mobi") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      deviceType = "mobile";
    }
  }

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      // Record open event publicly
      await dbStore.emailTrackers.updatePublic(tracker.id, {
        openCount: tracker.openCount + 1,
        lastOpenedAt: new Date(),
      });

      // Record granular open event
      await dbStore.emailOpenEvents.insert({
        orgId: tracker.orgId,
        trackerId: tracker.id,
        ipAddress,
        userAgent,
        deviceType,
      });

      // Record audit log for email tracking event
      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: tracker.activityId,
        recordType: "EmailTracking",
        action: "open",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          openCount: {
            before: tracker.openCount,
            after: tracker.openCount + 1,
          },
        },
      });

      // Task 0198: Trigger automated sequence open actions
      if (dbStore.marketingSequenceOpenActions) {
        await processSequenceEmailOpen(
          dbStore,
          tracker.orgId,
          tracker.activityId,
        );
      }

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  // 1x1 transparent GIF
  const transparentGif = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");

  return c.body(new Uint8Array(transparentGif));
});

app.get("/api/public/emails/track/click/:token", async (c) => {
  const { token } = c.req.param();
  const target = c.req.query("target");
  const ipAddress =
    c.req.header("x-forwarded-for") ||
    c.req.header("cf-connecting-ip") ||
    "127.0.0.1";
  const userAgent = c.req.header("user-agent") || "Unknown";

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      // Record click event publicly
      await dbStore.emailTrackers.updatePublic(tracker.id, {
        clickCount: tracker.clickCount + 1,
        lastClickedAt: new Date(),
      });

      // Record granular click event
      if (target && dbStore.emailClickEvents) {
        const utm = parseUtmParams(target);
        await dbStore.emailClickEvents.insert({
          orgId: tracker.orgId,
          trackerId: tracker.id,
          clickedUrl: target,
          ipAddress,
          userAgent,
          utmSource: utm.utmSource,
          utmMedium: utm.utmMedium,
          utmCampaign: utm.utmCampaign,
          utmTerm: utm.utmTerm,
          utmContent: utm.utmContent,
        });
      }

      // Record audit log
      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: tracker.activityId,
        recordType: "EmailTracking",
        action: "click",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          clickCount: {
            before: tracker.clickCount,
            after: tracker.clickCount + 1,
          },
          targetUrl: {
            before: "",
            after: target || "",
          },
        },
      });

      // Task 0197: Trigger automated sequence link actions
      if (dbStore.marketingSequenceLinkActions) {
        await processSequenceLinkClick(
          dbStore,
          tracker.orgId,
          tracker.activityId,
          target || "",
        );
      }

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  if (target) {
    return c.redirect(target, 302);
  }

  return c.redirect("/", 302);
});

app.post("/api/public/emails/track/reply/:token", async (c) => {
  const { token } = c.req.param();

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      // Record reply event publicly
      await dbStore.emailTrackers.updatePublic(tracker.id, {
        replyCount: tracker.replyCount + 1,
        lastRepliedAt: new Date(),
      });

      // Record audit log
      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: tracker.activityId,
        recordType: "EmailTracking",
        action: "reply",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          replyCount: {
            before: tracker.replyCount,
            after: tracker.replyCount + 1,
          },
        },
      });

      // Record granular reply event
      const bodyData = await c.req.json().catch(() => ({}));
      const replyBody = bodyData.replyBody || null;
      let senderEmail = bodyData.senderEmail;

      // Fallback for senderEmail if not provided: find linked lead/contact email
      if (!senderEmail) {
        const allLinks = await dbStore.activityLinks.findMany();
        const recipientLink = allLinks.find(
          (l) =>
            l.activityId === tracker.activityId && l.orgId === tracker.orgId,
        );
        if (recipientLink) {
          if (recipientLink.targetType.toLowerCase() === "lead") {
            const lead = await dbStore.leads.findOne(recipientLink.targetId);
            if (lead) senderEmail = lead.email;
          } else if (recipientLink.targetType.toLowerCase() === "contact") {
            const contact = await dbStore.contacts.findOne(
              recipientLink.targetId,
            );
            if (contact) senderEmail = contact.email;
          }
        }
      }
      if (!senderEmail) {
        senderEmail = "prospect@example.com";
      }

      // Sentiment categorization
      let sentiment = "neutral";
      if (replyBody) {
        const lowerBody = replyBody.toLowerCase();
        const positiveKeywords = [
          "interested",
          "yes",
          "please",
          "great",
          "thank",
        ];
        const negativeKeywords = [
          "remove",
          "stop",
          "unsubscribe",
          "not interested",
          "no",
        ];

        if (negativeKeywords.some((kw) => lowerBody.includes(kw))) {
          sentiment = "negative";
        } else if (positiveKeywords.some((kw) => lowerBody.includes(kw))) {
          sentiment = "positive";
        }
      }

      if (dbStore.emailReplyEvents) {
        await dbStore.emailReplyEvents.insert({
          orgId: tracker.orgId,
          trackerId: tracker.id,
          replyBody,
          senderEmail,
          sentiment,
        });
      }

      // Task 0199: Trigger automated sequence reply actions
      if (dbStore.marketingSequenceReplyActions) {
        await processSequenceEmailReply(
          dbStore,
          tracker.orgId,
          tracker.activityId,
        );
      }

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  return c.json({ success: true, message: "Reply event tracked successfully" });
});

app.post("/api/public/emails/track/bounce/:token", async (c) => {
  const { token } = c.req.param();

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      // Parse parameters from body
      const bodyData = await c.req.json().catch(() => ({}));
      const eventType = bodyData.eventType || "bounce";
      const bounceType = bodyData.bounceType || null;
      const bounceReason = bodyData.bounceReason || null;

      // Find recipient email using activity links
      let recipientEmail = "prospect@example.com";
      const allLinks = await dbStore.activityLinks.findMany();
      const recipientLink = allLinks.find(
        (l) => l.activityId === tracker.activityId && l.orgId === tracker.orgId,
      );
      if (recipientLink) {
        if (recipientLink.targetType.toLowerCase() === "lead") {
          const lead = await dbStore.leads.findOne(recipientLink.targetId);
          if (lead?.email) recipientEmail = lead.email;
        } else if (recipientLink.targetType.toLowerCase() === "contact") {
          const contact = await dbStore.contacts.findOne(
            recipientLink.targetId,
          );
          if (contact?.email) recipientEmail = contact.email;
        }
      }

      await handleEmailDeliveryEvent(dbStore, {
        orgId: tracker.orgId,
        email: recipientEmail,
        event: eventType as "bounce" | "complaint",
        reason: bounceReason || undefined,
        bounceType: bounceType || undefined,
        trackerId: tracker.id,
      });

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  return c.json({
    success: true,
    message: "Bounce event tracked successfully",
  });
});

app.post("/api/public/emails/track/read-time/:token", async (c) => {
  const { token } = c.req.param();
  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      const bodyData = await c.req.json().catch(() => ({}));
      const durationMs = Number(bodyData.durationMs) || 0;

      let readClassification = "glanced";
      if (durationMs >= 8000) {
        readClassification = "read";
      } else if (durationMs >= 2000) {
        readClassification = "skimmed";
      }

      await dbStore.emailTrackers.updatePublic(tracker.id, {
        totalReadTimeMs: tracker.totalReadTimeMs + durationMs,
        lastReadClassification: readClassification,
      });

      await dbStore.emailReadTimeEvents.insert({
        orgId: tracker.orgId,
        trackerId: tracker.id,
        durationMs,
        readClassification,
      });

      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: tracker.activityId,
        recordType: "EmailTracking",
        action: "read-time",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          totalReadTimeMs: {
            before: tracker.totalReadTimeMs,
            after: tracker.totalReadTimeMs + durationMs,
          },
          lastReadClassification: {
            before: tracker.lastReadClassification,
            after: readClassification,
          },
        },
      });

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  return c.json({
    success: true,
    message: "Read time event tracked successfully",
  });
});

app.get("/api/public/emails/unsubscribe/:token", async (c) => {
  const { token } = c.req.param();

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (!tracker) {
    return c.json({ success: false, error: "Invalid tracking token" }, 404);
  }

  await withTenant(tracker.orgId, mockDb, async () => {
    // Find target recipients linked to this email activity
    const allLinks = await dbStore.activityLinks.findMany();
    const recipients = allLinks.filter(
      (link) =>
        link.activityId === tracker.activityId &&
        (link.targetType === "Lead" || link.targetType === "Contact"),
    );

    for (const recipient of recipients) {
      const type = recipient.targetType.toLowerCase() as "lead" | "contact";

      // Check if consent preference already exists for logging purposes
      const allPrefs = await dbStore.contactConsentPreferences.findMany();
      const existing = allPrefs.find(
        (p) =>
          p.recordType === type &&
          p.recordId === recipient.targetId &&
          p.channel === "email",
      );

      await dbStore.contactConsentPreferences.upsert({
        orgId: tracker.orgId,
        recordType: type,
        recordId: recipient.targetId,
        channel: "email",
        status: "opt_out",
        source: "public_unsubscribe",
        updatedById: "00000000-0000-0000-0000-000000000000",
      });

      // Record audit log for unsubscription consent preference update
      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: recipient.targetId,
        recordType: "contact_consent_preferences",
        action: "upsert",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          status: {
            before: existing?.status || "pending",
            after: "opt_out",
          },
        },
      });

      // Transition any active marketing sequence memberships to unsubscribed
      const allMemberships =
        await dbStore.marketingSequenceMemberships.findMany();
      const matchingMemberships = allMemberships.filter(
        (m) =>
          m.recordId === recipient.targetId &&
          m.recordType.toLowerCase() === type.toLowerCase(),
      );
      for (const m of matchingMemberships) {
        await dbStore.marketingSequenceMemberships.update(m.id, {
          status: "unsubscribed",
        });
        await recalculateMemberEngagementScore(m.id);
      }
    }
  });

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Unsubscribed Successfully</title>
    <style>
      body {
        font-family: 'Inter', -apple-system, sans-serif;
        background: #f3f4f6;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
      }
      .card {
        background: white;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        text-align: center;
        max-width: 400px;
      }
      h1 { color: #1f2937; font-size: 24px; margin-bottom: 8px; }
      p { color: #4b5563; font-size: 16px; margin-bottom: 24px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Successfully Unsubscribed</h1>
      <p>Your email address has been opted out from our marketing and campaign communications.</p>
    </div>
  </body>
</html>`;

  c.header("Content-Type", "text/html");
  return c.body(html);
});

app.post("/api/public/emails/unsubscribe/:token/reason", async (c) => {
  const { token } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const { reason, feedback } = body;

  if (!reason) {
    return c.json({ success: false, error: "Reason is required" }, 400);
  }

  const allowedReasons = ["frequency", "relevance", "not_requested", "other"];
  if (!allowedReasons.includes(reason)) {
    return c.json({ success: false, error: "Invalid unsubscribe reason" }, 400);
  }

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (!tracker) {
    return c.json({ success: false, error: "Invalid tracking token" }, 404);
  }

  const newUnsub = await withTenant(tracker.orgId, mockDb, async () => {
    const inserted = await dbStore.emailUnsubscribes.insert({
      orgId: tracker.orgId,
      trackerId: tracker.id,
      reason,
      feedback: feedback || null,
    });

    // Record audit log
    await dbStore.auditLogs.insert({
      orgId: tracker.orgId,
      recordId: tracker.activityId,
      recordType: "EmailTracking",
      action: "unsubscribe_reason",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        reason: {
          before: null,
          after: reason,
        },
        feedback: {
          before: null,
          after: feedback || null,
        },
      },
    });

    return inserted;
  });

  return c.json({ success: true, data: newUnsub });
});

app.get("/api/unsubscribes", tenantAuth, async (c) => {
  const unsubs = await dbStore.emailUnsubscribes.findMany();
  const sorted = unsubs.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return c.json({ success: true, data: sorted });
});

app.get("/api/unsubscribes/analytics", tenantAuth, async (c) => {
  const unsubscribes = await dbStore.emailUnsubscribes.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const links = await dbStore.activityLinks.findMany();
  const memberships = await dbStore.marketingSequenceMemberships.findMany();
  const sequences = await dbStore.marketingSequences.findMany();

  const analytics = calculateUnsubscribeAnalytics({
    unsubscribes,
    trackers,
    links,
    memberships,
    sequences,
  });

  return c.json({ success: true, data: analytics });
});

// Marketing Sequences & Drip Journeys Endpoints

app.post("/api/sequences", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    description,
    status,
    allowReenrollment,
    reenrollmentMinDays,
    dailySendLimit,
    senderType,
    senderUserId,
    folderId,
  } = body;

  if (!name) {
    return c.json({ success: false, error: "Sequence name is required" }, 400);
  }

  if (folderId) {
    const folder = await dbStore.marketingSequenceFolders.findOne(folderId);
    if (!folder) {
      return c.json({ success: false, error: "Folder not found" }, 400);
    }
  }

  let parsedLimit: number | null = null;
  if (dailySendLimit !== undefined && dailySendLimit !== null) {
    const num = Number(dailySendLimit);
    if (!Number.isInteger(num) || num <= 0) {
      return c.json(
        { success: false, error: "dailySendLimit must be a positive integer" },
        400,
      );
    }
    parsedLimit = num;
  }

  let resolvedSenderType = "system";
  if (senderType !== undefined && senderType !== null) {
    if (
      senderType !== "system" &&
      senderType !== "owner" &&
      senderType !== "specific"
    ) {
      return c.json(
        {
          success: false,
          error: "senderType must be one of 'system', 'owner', or 'specific'",
        },
        400,
      );
    }
    resolvedSenderType = senderType;
  }

  let resolvedSenderUserId: string | null = null;
  if (resolvedSenderType === "specific") {
    if (!senderUserId) {
      return c.json(
        {
          success: false,
          error: "senderUserId is required when senderType is 'specific'",
        },
        400,
      );
    }
    const activeMembers = await dbStore.memberships.findMany();
    const isValidMember = activeMembers.some((m) => m.userId === senderUserId);
    if (!isValidMember) {
      return c.json(
        {
          success: false,
          error:
            "Invalid senderUserId: user does not belong to your organization",
        },
        400,
      );
    }
    resolvedSenderUserId = senderUserId;
  }

  const seq = await dbStore.marketingSequences.insert({
    orgId: tenant.orgId,
    name,
    description: description || "",
    status: status || "draft",
    allowReenrollment: allowReenrollment === true,
    reenrollmentMinDays: reenrollmentMinDays
      ? Number(reenrollmentMinDays)
      : null,
    dailySendLimit: parsedLimit,
    senderType: resolvedSenderType,
    senderUserId: resolvedSenderUserId,
    folderId: folderId || null,
  });

  return c.json({ success: true, sequence: seq });
});

app.patch("/api/sequences/:id", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    description,
    status,
    allowReenrollment,
    reenrollmentMinDays,
    dailySendLimit,
    senderType,
    senderUserId,
    folderId,
  } = body;

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (folderId !== undefined) {
    if (folderId !== null) {
      const folder = await dbStore.marketingSequenceFolders.findOne(folderId);
      if (!folder) {
        return c.json({ success: false, error: "Folder not found" }, 400);
      }
      updates.folderId = folderId;
    } else {
      updates.folderId = null;
    }
  }

  if (allowReenrollment !== undefined)
    updates.allowReenrollment = allowReenrollment === true;
  if (reenrollmentMinDays !== undefined) {
    updates.reenrollmentMinDays = reenrollmentMinDays
      ? Number(reenrollmentMinDays)
      : null;
  }
  if (dailySendLimit !== undefined) {
    if (dailySendLimit !== null) {
      const num = Number(dailySendLimit);
      if (!Number.isInteger(num) || num <= 0) {
        return c.json(
          {
            success: false,
            error: "dailySendLimit must be a positive integer",
          },
          400,
        );
      }
      updates.dailySendLimit = num;
    } else {
      updates.dailySendLimit = null;
    }
  }

  let resolvedSenderType =
    (updates.senderType as string) || seq.senderType || "system";
  if (senderType !== undefined) {
    if (
      senderType !== "system" &&
      senderType !== "owner" &&
      senderType !== "specific"
    ) {
      return c.json(
        {
          success: false,
          error: "senderType must be one of 'system', 'owner', or 'specific'",
        },
        400,
      );
    }
    updates.senderType = senderType;
    resolvedSenderType = senderType;
  }

  if (senderUserId !== undefined) {
    updates.senderUserId = senderUserId;
  }

  const finalSenderUserId =
    updates.senderUserId !== undefined
      ? (updates.senderUserId as string | null)
      : seq.senderUserId;
  if (resolvedSenderType === "specific") {
    if (!finalSenderUserId) {
      return c.json(
        {
          success: false,
          error: "senderUserId is required when senderType is 'specific'",
        },
        400,
      );
    }
    const activeMembers = await dbStore.memberships.findMany();
    const isValidMember = activeMembers.some(
      (m) => m.userId === finalSenderUserId,
    );
    if (!isValidMember) {
      return c.json(
        {
          success: false,
          error:
            "Invalid senderUserId: user does not belong to your organization",
        },
        400,
      );
    }
  } else {
    if (senderType !== undefined) {
      updates.senderUserId = null;
    }
  }

  const updated = await dbStore.marketingSequences.update(
    sequenceId,
    updates as Partial<
      Omit<DBMarketingSequence, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  );
  return c.json({ success: true, sequence: updated });
});

app.post("/api/sequences/:id/steps", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    stepNumber,
    delayDays,
    templateId,
    waitCondition,
    replyToStepNumber,
    stepType = "email",
    webhookUrl,
    webhookPayload,
  } = body;

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  if (stepNumber === undefined) {
    return c.json({ success: false, error: "stepNumber is required" }, 400);
  }

  if (stepType !== "email" && stepType !== "webhook" && stepType !== "task") {
    return c.json(
      { success: false, error: "stepType must be email, webhook, or task" },
      400,
    );
  }

  if (stepType === "email") {
    if (templateId === undefined) {
      return c.json(
        { success: false, error: "templateId is required for email steps" },
        400,
      );
    }
    const template = await dbStore.emailTemplates.findOne(templateId);
    if (!template) {
      return c.json({ success: false, error: "Email Template not found" }, 404);
    }
  } else if (stepType === "webhook") {
    if (
      !webhookUrl ||
      typeof webhookUrl !== "string" ||
      !/^https?:\/\//i.test(webhookUrl)
    ) {
      return c.json(
        {
          success: false,
          error:
            "webhookUrl is required and must be a valid HTTP/HTTPS URL for webhook steps",
        },
        400,
      );
    }
  } else if (stepType === "task") {
    if (!body.taskSubject || typeof body.taskSubject !== "string") {
      return c.json(
        { success: false, error: "taskSubject is required for task steps" },
        400,
      );
    }
  }

  if (replyToStepNumber !== undefined && replyToStepNumber !== null) {
    const replyStepNum = Number(replyToStepNumber);
    if (
      Number.isNaN(replyStepNum) ||
      !Number.isInteger(replyStepNum) ||
      replyStepNum < 1
    ) {
      return c.json(
        {
          success: false,
          error: "replyToStepNumber must be a positive integer",
        },
        400,
      );
    }
    if (replyStepNum >= Number(stepNumber)) {
      return c.json(
        {
          success: false,
          error:
            "replyToStepNumber must be strictly less than the current stepNumber",
        },
        400,
      );
    }

    const existingSteps =
      await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
    const targetStepExists = existingSteps.some(
      (s) => s.stepNumber === replyStepNum,
    );
    if (!targetStepExists) {
      return c.json(
        {
          success: false,
          error: `Target sequence step with stepNumber ${replyStepNum} not found in this sequence`,
        },
        400,
      );
    }
  }

  if (waitCondition) {
    if (typeof waitCondition !== "object") {
      return c.json(
        { success: false, error: "waitCondition must be an object" },
        400,
      );
    }
    const { waitType, daysOfWeek, timeOfDay } = waitCondition;
    if (waitType !== "day_of_week" && waitType !== "duration") {
      return c.json(
        {
          success: false,
          error: "waitCondition.waitType must be day_of_week or duration",
        },
        400,
      );
    }
    if (waitType === "day_of_week") {
      if (
        !Array.isArray(daysOfWeek) ||
        daysOfWeek.some((d: unknown) => typeof d !== "number" || d < 0 || d > 6)
      ) {
        return c.json(
          {
            success: false,
            error:
              "waitCondition.daysOfWeek must be an array of numbers between 0 and 6",
          },
          400,
        );
      }
      if (
        timeOfDay !== undefined &&
        timeOfDay !== null &&
        (typeof timeOfDay !== "string" || !/^\d{2}:\d{2}$/.test(timeOfDay))
      ) {
        return c.json(
          {
            success: false,
            error: "waitCondition.timeOfDay must be in HH:mm format",
          },
          400,
        );
      }
    }
  }

  const step = await dbStore.marketingSequenceSteps.insert({
    orgId: tenant.orgId,
    sequenceId,
    stepNumber: Number(stepNumber),
    delayDays: delayDays !== undefined ? Number(delayDays) : 0,
    templateId: stepType === "email" ? templateId : null,
    waitCondition: waitCondition || null,
    replyToStepNumber:
      replyToStepNumber !== undefined && replyToStepNumber !== null
        ? Number(replyToStepNumber)
        : null,
    stepType,
    webhookUrl: stepType === "webhook" ? webhookUrl : null,
    webhookPayload: stepType === "webhook" ? webhookPayload || null : null,
    taskSubject: stepType === "task" ? body.taskSubject || null : null,
    taskBody: stepType === "task" ? body.taskBody || null : null,
    taskDueDays:
      stepType === "task"
        ? body.taskDueDays !== undefined && body.taskDueDays !== null
          ? Number(body.taskDueDays)
          : null
        : null,
  });

  return c.json({ success: true, step });
});

app.post("/api/sequences/:id/enroll", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { recordType, recordId } = body;

  if (!recordType || !recordId) {
    return c.json(
      { success: false, error: "recordType and recordId are required" },
      400,
    );
  }

  if (recordType !== "lead" && recordType !== "contact") {
    return c.json(
      { success: false, error: "recordType must be lead or contact" },
      400,
    );
  }

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  if (recordType === "lead") {
    const lead = await dbStore.leads.findOne(recordId);
    if (!lead) {
      return c.json({ success: false, error: "Lead not found" }, 404);
    }
  } else {
    const contact = await dbStore.contacts.findOne(recordId);
    if (!contact) {
      return c.json({ success: false, error: "Contact not found" }, 404);
    }
  }

  try {
    const membership = await enrollInSequence(
      dbStore,
      tenant.orgId,
      sequenceId,
      recordType,
      recordId,
    );
    return c.json({ success: true, membership });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 400);
  }
});

app.post("/api/sequences/execute", tenantAuth, async (c) => {
  const processed = await executePendingSequenceSteps(dbStore, new Date());
  return c.json({ success: true, processedCount: processed });
});

app.post("/api/sequences/preview", tenantAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { subject, body: bodyText, recordType, recordId } = body;

  if (!subject && !bodyText) {
    return c.json(
      { success: false, error: "Subject or body is required" },
      400,
    );
  }
  if (!recordType || !recordId) {
    return c.json(
      { success: false, error: "recordType and recordId are required" },
      400,
    );
  }
  if (recordType !== "lead" && recordType !== "contact") {
    return c.json(
      { success: false, error: "recordType must be lead or contact" },
      400,
    );
  }

  let record: Record<string, unknown> | null = null;
  if (recordType === "lead") {
    record = (await dbStore.leads.findOne(recordId)) as Record<
      string,
      unknown
    > | null;
  } else if (recordType === "contact") {
    record = (await dbStore.contacts.findOne(recordId)) as Record<
      string,
      unknown
    > | null;
  }

  if (!record) {
    return c.json({ success: false, error: "Record not found" }, 404);
  }

  let account: Record<string, unknown> | null = null;
  if (recordType === "contact" && record.accountId) {
    account = (await dbStore.accounts.findOne(
      record.accountId as string,
    )) as Record<string, unknown> | null;
  }

  const globalVars = await dbStore.marketingSequenceGlobalVariables.findMany();
  const globalVariablesMap: Record<string, string> = {};
  for (const v of globalVars) {
    globalVariablesMap[v.key] = v.value;
  }

  const recipientContext = {
    lead: recordType === "lead" ? record : null,
    contact: recordType === "contact" ? record : null,
    account,
    globalVariables: globalVariablesMap,
  };

  const compiled = compileEmailTemplate(
    { subject: subject || "", body: bodyText || "" },
    recipientContext,
  );

  return c.json({ success: true, data: compiled });
});

app.get("/api/sequences/:id/members", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const members =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  return c.json({ success: true, data: members });
});

app.get("/api/sequences/:id/analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const emailTrackers = await dbStore.emailTrackers.findMany();

  const analytics = calculateSequenceAnalytics({
    sequenceId,
    steps,
    memberships,
    activities,
    activityLinks,
    emailTrackers,
  });

  return c.json({ success: true, data: analytics });
});

app.get("/api/sequences/:id/exit-triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }
  const triggers =
    await dbStore.marketingSequenceExitTriggers.findForSequence(sequenceId);
  return c.json({ success: true, data: triggers });
});

app.post("/api/sequences/:id/exit-triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { triggerType, criteria } = body;

  if (
    !triggerType ||
    (triggerType !== "lead_status_changed" &&
      triggerType !== "opportunity_stage_changed")
  ) {
    return c.json(
      { success: false, error: "Invalid or missing triggerType" },
      400,
    );
  }

  if (!criteria) {
    return c.json({ success: false, error: "Missing trigger criteria" }, 400);
  }

  const trigger = await dbStore.marketingSequenceExitTriggers.insert({
    orgId: tenant.orgId,
    sequenceId,
    triggerType,
    criteria,
    isActive: 1,
  });

  return c.json({ success: true, data: trigger });
});

app.delete(
  "/api/sequences/:id/exit-triggers/:triggerId",
  tenantAuth,
  async (c) => {
    const sequenceId = c.req.param("id");
    const triggerId = c.req.param("triggerId");

    const seq = await dbStore.marketingSequences.findOne(sequenceId);
    if (!seq) {
      return c.json({ success: false, error: "Sequence not found" }, 404);
    }

    const trigger =
      await dbStore.marketingSequenceExitTriggers.findOne(triggerId);
    if (!trigger) {
      return c.json({ success: false, error: "Exit trigger not found" }, 404);
    }

    if (trigger.sequenceId !== sequenceId) {
      return c.json(
        { success: false, error: "Exit trigger sequence mismatch" },
        400,
      );
    }

    await dbStore.marketingSequenceExitTriggers.delete(triggerId);
    return c.json({ success: true });
  },
);

// Marketing Sequence A/B Split Testing Endpoints

app.get(
  "/api/sequences/:id/steps/:stepId/split-test",
  tenantAuth,
  async (c) => {
    const sequenceId = c.req.param("id");
    const stepId = c.req.param("stepId");

    const seq = await dbStore.marketingSequences.findOne(sequenceId);
    if (!seq) {
      return c.json({ success: false, error: "Sequence not found" }, 404);
    }

    const step = await dbStore.marketingSequenceSteps.findOne(stepId);
    if (!step || step.sequenceId !== sequenceId) {
      return c.json({ success: false, error: "Sequence step not found" }, 404);
    }

    const splitTest =
      await dbStore.marketingSequenceStepSplitTests.findForStep(stepId);
    return c.json({ success: true, data: splitTest });
  },
);

app.post(
  "/api/sequences/:id/steps/:stepId/split-test",
  tenantAuth,
  async (c) => {
    const sequenceId = c.req.param("id");
    const stepId = c.req.param("stepId");
    const tenant = c.get("tenant");

    const seq = await dbStore.marketingSequences.findOne(sequenceId);
    if (!seq) {
      return c.json({ success: false, error: "Sequence not found" }, 404);
    }

    const step = await dbStore.marketingSequenceSteps.findOne(stepId);
    if (!step || step.sequenceId !== sequenceId) {
      return c.json({ success: false, error: "Sequence step not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const {
      variantTemplateId,
      splitWeight,
      isActive,
      autoPromoteWinner,
      minSendsToEvaluate,
      evaluationMetric,
    } = body;

    if (!variantTemplateId) {
      return c.json(
        { success: false, error: "variantTemplateId is required" },
        400,
      );
    }

    if (
      autoPromoteWinner !== undefined &&
      autoPromoteWinner !== 0 &&
      autoPromoteWinner !== 1
    ) {
      return c.json(
        { success: false, error: "autoPromoteWinner must be 0 or 1" },
        400,
      );
    }

    if (
      minSendsToEvaluate !== undefined &&
      (typeof minSendsToEvaluate !== "number" || minSendsToEvaluate <= 0)
    ) {
      return c.json(
        {
          success: false,
          error: "minSendsToEvaluate must be a positive integer",
        },
        400,
      );
    }

    if (
      evaluationMetric !== undefined &&
      evaluationMetric !== "open_rate" &&
      evaluationMetric !== "click_rate"
    ) {
      return c.json(
        {
          success: false,
          error: "evaluationMetric must be open_rate or click_rate",
        },
        400,
      );
    }

    const template = await dbStore.emailTemplates.findOne(variantTemplateId);
    if (!template) {
      return c.json(
        { success: false, error: "Variant template not found" },
        404,
      );
    }

    const existing =
      await dbStore.marketingSequenceStepSplitTests.findForStep(stepId);
    if (existing) {
      await dbStore.marketingSequenceStepSplitTests.delete(existing.id);
    }

    const splitTest = await dbStore.marketingSequenceStepSplitTests.insert({
      orgId: tenant.orgId,
      stepId,
      variantTemplateId,
      splitWeight: typeof splitWeight === "number" ? splitWeight : 50,
      isActive: isActive === 0 ? 0 : 1,
      autoPromoteWinner:
        typeof autoPromoteWinner === "number" ? autoPromoteWinner : 0,
      minSendsToEvaluate:
        typeof minSendsToEvaluate === "number" ? minSendsToEvaluate : 10,
      evaluationMetric:
        typeof evaluationMetric === "string" ? evaluationMetric : "open_rate",
    });

    return c.json({ success: true, data: splitTest });
  },
);

app.post(
  "/api/sequences/:id/steps/:stepId/split-test/allocate",
  tenantAuth,
  async (c) => {
    const sequenceId = c.req.param("id");
    const stepId = c.req.param("stepId");
    const tenant = c.get("tenant");

    const seq = await dbStore.marketingSequences.findOne(sequenceId);
    if (!seq) {
      return c.json({ success: false, error: "Sequence not found" }, 404);
    }

    const step = await dbStore.marketingSequenceSteps.findOne(stepId);
    if (!step || step.sequenceId !== sequenceId) {
      return c.json({ success: false, error: "Sequence step not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const { membershipId, allocatedTemplateId } = body;

    if (!membershipId || !allocatedTemplateId) {
      return c.json(
        {
          success: false,
          error: "membershipId and allocatedTemplateId are required",
        },
        400,
      );
    }

    const membership =
      await dbStore.marketingSequenceMemberships.findOne(membershipId);
    if (!membership || membership.sequenceId !== sequenceId) {
      return c.json(
        { success: false, error: "Sequence membership not found" },
        404,
      );
    }

    const template = await dbStore.emailTemplates.findOne(allocatedTemplateId);
    if (!template) {
      return c.json(
        { success: false, error: "Allocated template not found" },
        404,
      );
    }

    const allocation = await dbStore.marketingSequenceAbAllocations.insert({
      orgId: tenant.orgId,
      membershipId,
      stepId,
      allocatedTemplateId,
    });

    return c.json({ success: true, data: allocation });
  },
);

// Marketing Sequence Dynamic Branching Endpoints

app.get("/api/sequences/:id/steps/:stepId/branch", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const step = await dbStore.marketingSequenceSteps.findOne(stepId);
  if (!step || step.sequenceId !== sequenceId) {
    return c.json({ success: false, error: "Sequence step not found" }, 404);
  }

  const branch =
    await dbStore.marketingSequenceStepBranches.findForStep(stepId);
  if (!branch) {
    return c.json({ success: false, error: "Branch not found" }, 404);
  }
  return c.json({ success: true, data: branch });
});

app.post("/api/sequences/:id/steps/:stepId/branch", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const step = await dbStore.marketingSequenceSteps.findOne(stepId);
  if (!step || step.sequenceId !== sequenceId) {
    return c.json({ success: false, error: "Sequence step not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const {
    branchType,
    evaluationWindowDays,
    trueNextStepNumber,
    falseNextStepNumber,
  } = body;

  if (
    !branchType ||
    typeof trueNextStepNumber !== "number" ||
    typeof falseNextStepNumber !== "number"
  ) {
    return c.json(
      {
        success: false,
        error:
          "branchType, trueNextStepNumber, and falseNextStepNumber are required",
      },
      400,
    );
  }

  const existing =
    await dbStore.marketingSequenceStepBranches.findForStep(stepId);
  if (existing) {
    await dbStore.marketingSequenceStepBranches.delete(existing.id);
  }

  const branch = await dbStore.marketingSequenceStepBranches.insert({
    orgId: tenant.orgId,
    stepId,
    branchType,
    evaluationWindowDays:
      typeof evaluationWindowDays === "number" ? evaluationWindowDays : 3,
    trueNextStepNumber,
    falseNextStepNumber,
  });

  return c.json({ success: true, data: branch });
});

app.delete("/api/sequences/:id/steps/:stepId/branch", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const step = await dbStore.marketingSequenceSteps.findOne(stepId);
  if (!step || step.sequenceId !== sequenceId) {
    return c.json({ success: false, error: "Sequence step not found" }, 404);
  }

  const branch =
    await dbStore.marketingSequenceStepBranches.findForStep(stepId);
  if (!branch) {
    return c.json({ success: false, error: "Branch not found" }, 404);
  }

  await dbStore.marketingSequenceStepBranches.delete(branch.id);
  return c.json({ success: true });
});

app.get("/api/sequences/:id/goals", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const goals =
    await dbStore.marketingSequenceGoals.findForSequence(sequenceId);
  return c.json({ success: true, data: goals });
});

app.post("/api/sequences/:id/goals", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { goalType, targetValue } = body;

  if (!goalType) {
    return c.json({ success: false, error: "Goal type is required" }, 400);
  }

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  // Deactivate/delete any existing goals for simplicity
  const existing =
    await dbStore.marketingSequenceGoals.findForSequence(sequenceId);
  for (const g of existing) {
    await dbStore.marketingSequenceGoals.delete(g.id);
  }

  const goal = await dbStore.marketingSequenceGoals.insert({
    orgId: tenant.orgId,
    sequenceId,
    goalType,
    targetValue: targetValue || null,
    isActive: 1,
  });

  return c.json({ success: true, data: goal });
});

app.get("/api/sequences/suppressions", tenantAuth, async (c) => {
  const suppressions = await dbStore.marketingSequenceSuppressions.findMany();
  return c.json({ success: true, data: suppressions });
});

app.post("/api/sequences/suppressions", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { recordType, recordId, pattern, reason } = body;

  if (!recordType) {
    return c.json({ success: false, error: "Record type is required" }, 400);
  }

  const suppression = await dbStore.marketingSequenceSuppressions.insert({
    orgId: tenant.orgId,
    recordType,
    recordId: recordId || null,
    pattern: pattern || null,
    reason: reason || "opt_out",
  });

  return c.json({ success: true, data: suppression });
});

app.delete("/api/sequences/suppressions/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.marketingSequenceSuppressions.delete(id);
  if (!deleted) {
    return c.json(
      { success: false, error: "Suppression record not found or unauthorized" },
      404,
    );
  }
  return c.json({ success: true, message: "Suppression removed" });
});

app.get("/api/sequences/:id/exclusions", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const exclusions =
    await dbStore.marketingSequenceExclusions.findForSequence(sequenceId);
  return c.json({ success: true, data: exclusions });
});

app.post("/api/sequences/:id/exclusions", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { exclusionType, exclusionValue } = body;

  if (!exclusionType || !exclusionValue) {
    return c.json(
      { success: false, error: "Exclusion type and value are required" },
      400,
    );
  }

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const exclusion = await dbStore.marketingSequenceExclusions.insert({
    orgId: tenant.orgId,
    sequenceId,
    exclusionType,
    exclusionValue,
  });

  return c.json({ success: true, data: exclusion });
});

app.delete(
  "/api/sequences/:id/exclusions/:exclusionId",
  tenantAuth,
  async (c) => {
    const exclusionId = c.req.param("exclusionId");
    const deleted =
      await dbStore.marketingSequenceExclusions.delete(exclusionId);
    if (!deleted) {
      return c.json(
        { success: false, error: "Exclusion rule not found or unauthorized" },
        404,
      );
    }
    return c.json({ success: true, message: "Exclusion removed" });
  },
);

app.get("/api/sequences/:id/conversion-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const conversions =
    await dbStore.marketingSequenceConversions.findForSequence(sequenceId);

  const totalEnrolled = memberships.length;
  const convertedCount = conversions.length;
  const conversionRate =
    totalEnrolled > 0
      ? `${((convertedCount / totalEnrolled) * 100).toFixed(2)}%`
      : "0.00%";

  const totalAttributedRevenue = conversions
    .reduce((sum, conv) => {
      const amt = Number.parseFloat(conv.attributedRevenue || "0.00");
      return sum + (Number.isNaN(amt) ? 0 : amt);
    }, 0)
    .toFixed(2);

  // Calculate average days to convert
  let totalDays = 0;
  let convertTimeCount = 0;

  for (const conv of conversions) {
    const memb = memberships.find((m) => m.id === conv.membershipId);
    if (memb?.createdAt) {
      const diffMs =
        new Date(conv.convertedAt).getTime() -
        new Date(memb.createdAt).getTime();
      totalDays += diffMs / (1000 * 60 * 60 * 24);
      convertTimeCount++;
    }
  }

  const averageDaysToConvert =
    convertTimeCount > 0
      ? Number.parseFloat((totalDays / convertTimeCount).toFixed(2))
      : 0;

  return c.json({
    success: true,
    data: {
      sequenceId,
      totalEnrolled,
      convertedCount,
      conversionRate,
      totalAttributedRevenue,
      averageDaysToConvert,
    },
  });
});

// Marketing Segments & Dynamic Lists Endpoints

app.post("/api/segments", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, description, objectType, criteria } = body;

  if (!name) {
    return c.json({ success: false, error: "Segment name is required" }, 400);
  }

  if (!objectType || (objectType !== "lead" && objectType !== "contact")) {
    return c.json(
      { success: false, error: "objectType must be lead or contact" },
      400,
    );
  }

  if (!criteria || !Array.isArray(criteria)) {
    return c.json(
      { success: false, error: "criteria is required and must be an array" },
      400,
    );
  }

  const segment = await dbStore.marketingSegments.insert({
    orgId: tenant.orgId,
    name,
    description: description || "",
    objectType,
    criteria,
  });

  return c.json({ success: true, segment });
});

app.get("/api/segments", tenantAuth, async (c) => {
  const segments = await dbStore.marketingSegments.findMany();
  return c.json({ success: true, data: segments });
});

app.get("/api/segments/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const segment = await dbStore.marketingSegments.findOne(id);
  if (!segment) {
    return c.json({ success: false, error: "Segment not found" }, 404);
  }
  return c.json({ success: true, segment });
});

app.delete("/api/segments/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const success = await dbStore.marketingSegments.delete(id);
  if (!success) {
    return c.json(
      { success: false, error: "Segment not found or delete failed" },
      404,
    );
  }
  return c.json({ success: true });
});

app.get("/api/segments/:id/members", tenantAuth, async (c) => {
  const segmentId = c.req.param("id");
  const tenant = c.get("tenant");

  try {
    const members = await resolveSegmentMembers(
      dbStore,
      tenant.orgId,
      segmentId,
    );
    return c.json({ success: true, data: members });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        success: false,
        error: msg || "Failed to resolve segment members",
      },
      404,
    );
  }
});

app.post("/api/segments/:id/enroll-sequence", tenantAuth, async (c) => {
  const segmentId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { sequenceId } = body;

  if (!sequenceId) {
    return c.json({ success: false, error: "sequenceId is required" }, 400);
  }

  try {
    const result = await enrollSegmentInSequence(
      dbStore,
      tenant.orgId,
      segmentId,
      sequenceId,
    );
    return c.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        success: false,
        error: msg || "Failed to enroll segment in sequence",
      },
      400,
    );
  }
});

app.post("/api/sequences/:id/enroll-segment", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { segmentId } = body;

  if (!segmentId) {
    return c.json({ success: false, error: "segmentId is required" }, 400);
  }

  try {
    const result = await enrollSegmentInSequence(
      dbStore,
      tenant.orgId,
      segmentId,
      sequenceId,
    );
    return c.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        success: false,
        error: msg || "Failed to enroll segment in sequence",
      },
      400,
    );
  }
});

app.post("/api/sequences/:id/schedule", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { sendingWindowStart, sendingWindowEnd, sendingDays, dailySendLimit } =
    body;

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence || sequence.orgId !== tenant.orgId) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (
    sendingWindowStart !== undefined &&
    sendingWindowStart !== null &&
    !timeRegex.test(sendingWindowStart)
  ) {
    return c.json(
      { success: false, error: "sendingWindowStart must be in HH:MM format" },
      400,
    );
  }
  if (
    sendingWindowEnd !== undefined &&
    sendingWindowEnd !== null &&
    !timeRegex.test(sendingWindowEnd)
  ) {
    return c.json(
      { success: false, error: "sendingWindowEnd must be in HH:MM format" },
      400,
    );
  }

  if (sendingDays !== undefined && sendingDays !== null) {
    if (!Array.isArray(sendingDays)) {
      return c.json(
        { success: false, error: "sendingDays must be an array of numbers" },
        400,
      );
    }
    for (const d of sendingDays) {
      if (typeof d !== "number" || d < 1 || d > 7 || !Number.isInteger(d)) {
        return c.json(
          {
            success: false,
            error: "sendingDays values must be integers between 1 and 7",
          },
          400,
        );
      }
    }
  }

  let parsedLimit: number | null = sequence.dailySendLimit || null;
  if (dailySendLimit !== undefined) {
    if (dailySendLimit === null) {
      parsedLimit = null;
    } else {
      const num = Number(dailySendLimit);
      if (!Number.isInteger(num) || num <= 0) {
        return c.json(
          {
            success: false,
            error: "dailySendLimit must be a positive integer",
          },
          400,
        );
      }
      parsedLimit = num;
    }
  }

  const originalWindowStart = sequence.sendingWindowStart;
  const originalWindowEnd = sequence.sendingWindowEnd;
  const originalDays = sequence.sendingDays;
  const originalLimit = sequence.dailySendLimit;

  const updated = await dbStore.marketingSequences.update(sequenceId, {
    sendingWindowStart:
      sendingWindowStart !== undefined
        ? sendingWindowStart
        : originalWindowStart,
    sendingWindowEnd:
      sendingWindowEnd !== undefined ? sendingWindowEnd : originalWindowEnd,
    sendingDays: sendingDays !== undefined ? sendingDays : originalDays,
    dailySendLimit: dailySendLimit !== undefined ? parsedLimit : originalLimit,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: sequenceId,
    recordType: "marketing_sequences",
    action: "sequence_schedule_updated",
    userId: "00000000-0000-0000-0000-000000000000",
    changes: {
      sendingWindowStart: {
        before: originalWindowStart,
        after: sendingWindowStart,
      },
      sendingWindowEnd: { before: originalWindowEnd, after: sendingWindowEnd },
      sendingDays: { before: originalDays, after: sendingDays },
      dailySendLimit: { before: originalLimit, after: parsedLimit },
    },
  });

  return c.json({ success: true, data: updated });
});

app.post(
  "/api/sequences/memberships/:membershipId/snooze",
  tenantAuth,
  async (c) => {
    const membershipId = c.req.param("membershipId");
    const tenant = c.get("tenant");
    const body = await c.req.json().catch(() => ({}));
    const { snoozeUntil, reason } = body;

    if (!snoozeUntil) {
      return c.json({ success: false, error: "snoozeUntil is required" }, 400);
    }

    const membership =
      await dbStore.marketingSequenceMemberships.findOne(membershipId);
    if (!membership || membership.orgId !== tenant.orgId) {
      return c.json({ success: false, error: "Membership not found" }, 404);
    }

    const snoozeDate = new Date(snoozeUntil);
    if (Number.isNaN(snoozeDate.getTime())) {
      return c.json(
        { success: false, error: "Invalid snoozeUntil date format" },
        400,
      );
    }

    const originalStatus = membership.status;
    const originalSnoozeUntil = membership.snoozeUntil;

    const updated = await dbStore.marketingSequenceMemberships.update(
      membershipId,
      {
        status: "snoozed",
        snoozeUntil: snoozeDate,
        snoozeReason: reason || null,
      },
    );

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: membershipId,
      recordType: "marketing_sequence_memberships",
      action: "membership_snoozed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: originalStatus, after: "snoozed" },
        snoozeUntil: {
          before: originalSnoozeUntil
            ? new Date(originalSnoozeUntil).toISOString()
            : null,
          after: snoozeDate.toISOString(),
        },
      },
    });

    return c.json({ success: true, data: updated });
  },
);

app.post(
  "/api/sequences/memberships/:membershipId/resume",
  tenantAuth,
  async (c) => {
    const membershipId = c.req.param("membershipId");
    const tenant = c.get("tenant");

    const membership =
      await dbStore.marketingSequenceMemberships.findOne(membershipId);
    if (!membership || membership.orgId !== tenant.orgId) {
      return c.json({ success: false, error: "Membership not found" }, 404);
    }

    const originalStatus = membership.status;
    const originalSnoozeUntil = membership.snoozeUntil;

    const updated = await dbStore.marketingSequenceMemberships.update(
      membershipId,
      {
        status: "active",
        snoozeUntil: null,
        snoozeReason: null,
        nextExecutionAt: new Date(),
      },
    );

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: membershipId,
      recordType: "marketing_sequence_memberships",
      action: "membership_resumed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: originalStatus, after: "active" },
        snoozeUntil: {
          before: originalSnoozeUntil
            ? originalSnoozeUntil.toISOString()
            : null,
          after: null,
        },
      },
    });

    return c.json({ success: true, data: updated });
  },
);

app.post("/api/sequences/email-event", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { email, event, reason } = body;

  if (!email || !event) {
    return c.json(
      { success: false, error: "Email and event type are required" },
      400,
    );
  }

  if (event !== "bounce" && event !== "complaint") {
    return c.json(
      { success: false, error: "Event must be 'bounce' or 'complaint'" },
      400,
    );
  }

  const result = await handleEmailDeliveryEvent(dbStore, {
    orgId: tenant.orgId,
    email,
    event,
    reason,
  });

  return c.json({ success: true, data: result });
});

app.get("/api/sequences/settings/variables", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const variables = await dbStore.marketingSequenceGlobalVariables.findMany();
  return c.json({ success: true, data: variables });
});

app.post("/api/sequences/settings/variables", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { key, value } = body;

  if (!key || typeof key !== "string" || !/^[A-Za-z0-9_]+$/.test(key)) {
    return c.json(
      {
        success: false,
        error:
          "key is required and must contain only alphanumeric characters and underscores",
      },
      400,
    );
  }

  if (value === undefined || typeof value !== "string") {
    return c.json(
      {
        success: false,
        error: "value is required and must be a string",
      },
      400,
    );
  }

  const variable = await dbStore.marketingSequenceGlobalVariables.insert({
    orgId: tenant.orgId,
    key,
    value,
  });

  return c.json({ success: true, data: variable }, 201);
});

app.delete("/api/sequences/settings/variables/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const variable = await dbStore.marketingSequenceGlobalVariables.findOne(id);
  if (!variable) {
    return c.json({ success: false, error: "Global variable not found" }, 404);
  }

  const deleted = await dbStore.marketingSequenceGlobalVariables.delete(id);
  if (!deleted) {
    return c.json({ success: false, error: "Global variable not found" }, 404);
  }

  return c.json({
    success: true,
    message: "Global variable deleted successfully",
  });
});

app.get("/api/sequences/settings/caps", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const caps = await dbStore.marketingSequenceCaps.findMany();
  if (caps.length === 0) {
    return c.json({
      success: true,
      data: {
        domainThrottleLimit: 5,
        recipientFrequencyCap: 3,
      },
    });
  }
  return c.json({ success: true, data: caps[0] });
});

app.post("/api/sequences/settings/caps", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { domainThrottleLimit, recipientFrequencyCap } = body;

  if (domainThrottleLimit !== undefined) {
    const num = Number(domainThrottleLimit);
    if (!Number.isInteger(num) || num <= 0) {
      return c.json(
        {
          success: false,
          error: "domainThrottleLimit must be a positive integer",
        },
        400,
      );
    }
  }

  if (recipientFrequencyCap !== undefined) {
    const num = Number(recipientFrequencyCap);
    if (!Number.isInteger(num) || num <= 0) {
      return c.json(
        {
          success: false,
          error: "recipientFrequencyCap must be a positive integer",
        },
        400,
      );
    }
  }

  const caps = await dbStore.marketingSequenceCaps.findMany();
  if (caps.length === 0) {
    const inserted = await dbStore.marketingSequenceCaps.insert({
      orgId: tenant.orgId,
      domainThrottleLimit:
        domainThrottleLimit !== undefined ? Number(domainThrottleLimit) : 5,
      recipientFrequencyCap:
        recipientFrequencyCap !== undefined ? Number(recipientFrequencyCap) : 3,
    });
    return c.json({ success: true, data: inserted });
  }
  const updated = await dbStore.marketingSequenceCaps.update(caps[0].id, {
    domainThrottleLimit:
      domainThrottleLimit !== undefined
        ? Number(domainThrottleLimit)
        : caps[0].domainThrottleLimit,
    recipientFrequencyCap:
      recipientFrequencyCap !== undefined
        ? Number(recipientFrequencyCap)
        : caps[0].recipientFrequencyCap,
  });
  return c.json({ success: true, data: updated });
});

app.get("/api/sequences/steps/:stepId/link-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const actions =
    await dbStore.marketingSequenceLinkActions.findForStep(stepId);
  return c.json({ success: true, data: actions });
});

app.post("/api/sequences/steps/:stepId/link-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { targetUrl, actionType, actionConfig } = body;

  if (!targetUrl || !actionType || !actionConfig) {
    return c.json(
      {
        success: false,
        error: "targetUrl, actionType, and actionConfig are required",
      },
      400,
    );
  }
  if (actionType !== "field_update" && actionType !== "create_task") {
    return c.json(
      {
        success: false,
        error: "actionType must be 'field_update' or 'create_task'",
      },
      400,
    );
  }

  const action = await dbStore.marketingSequenceLinkActions.insert({
    orgId: tenant.orgId,
    stepId,
    targetUrl,
    actionType,
    actionConfig,
  });

  return c.json({ success: true, data: action });
});

app.delete("/api/sequences/steps/link-actions/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.marketingSequenceLinkActions.delete(id);
  if (!deleted) {
    return c.json(
      { success: false, error: "Link action not found or unauthorized" },
      404,
    );
  }
  return c.json({ success: true });
});

app.get("/api/sequences/steps/:stepId/open-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const actions =
    await dbStore.marketingSequenceOpenActions.findForStep(stepId);
  return c.json({ success: true, data: actions });
});

app.post("/api/sequences/steps/:stepId/open-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { actionType, actionConfig } = body;

  if (!actionType || !actionConfig) {
    return c.json(
      {
        success: false,
        error: "actionType and actionConfig are required",
      },
      400,
    );
  }
  if (actionType !== "field_update" && actionType !== "create_task") {
    return c.json(
      {
        success: false,
        error: "actionType must be 'field_update' or 'create_task'",
      },
      400,
    );
  }

  const action = await dbStore.marketingSequenceOpenActions.insert({
    orgId: tenant.orgId,
    stepId,
    actionType,
    actionConfig,
  });

  return c.json({ success: true, data: action });
});

app.delete("/api/sequences/steps/open-actions/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.marketingSequenceOpenActions.delete(id);
  if (!deleted) {
    return c.json(
      { success: false, error: "Open action not found or unauthorized" },
      404,
    );
  }
  return c.json({ success: true });
});

app.get("/api/sequences/steps/:stepId/reply-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const actions =
    await dbStore.marketingSequenceReplyActions.findForStep(stepId);
  return c.json({ success: true, data: actions });
});

app.post(
  "/api/sequences/steps/:stepId/reply-actions",
  tenantAuth,
  async (c) => {
    const stepId = c.req.param("stepId");
    const tenant = c.get("tenant");
    const body = await c.req.json().catch(() => ({}));
    const { actionType, actionConfig } = body;

    if (!actionType || !actionConfig) {
      return c.json(
        {
          success: false,
          error: "actionType and actionConfig are required",
        },
        400,
      );
    }
    if (actionType !== "field_update" && actionType !== "create_task") {
      return c.json(
        {
          success: false,
          error: "actionType must be 'field_update' or 'create_task'",
        },
        400,
      );
    }

    const action = await dbStore.marketingSequenceReplyActions.insert({
      orgId: tenant.orgId,
      stepId,
      actionType,
      actionConfig,
    });

    return c.json({ success: true, data: action });
  },
);

app.delete("/api/sequences/steps/reply-actions/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.marketingSequenceReplyActions.delete(id);
  if (!deleted) {
    return c.json(
      { success: false, error: "Reply action not found or unauthorized" },
      404,
    );
  }
  return c.json({ success: true });
});

app.get("/api/sequences/:id/links-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const clicks = await dbStore.emailClickEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateLinkEngagementAnalytics({
    clicks,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

app.get("/api/sequences/:id/opens-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const opens = await dbStore.emailOpenEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateOpenAnalytics({
    opens,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

app.get("/api/sequences/:id/replies-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const replies = await dbStore.emailReplyEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateReplyAnalytics({
    replies,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

app.get("/api/sequences/:id/bounces-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const bounces = await dbStore.emailBounceEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateBounceAnalytics({
    bounces,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

app.get("/api/sequences/:id/read-time-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const readTimeEvents = await dbStore.emailReadTimeEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateReadTimeAnalytics({
    readTimeEvents,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

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

app.get("/api/sequences/:id/engagement-scores", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);

  const data = [];
  for (const m of memberships) {
    let name = "Unknown";
    let email = "prospect@example.com";

    if (m.recordType === "lead") {
      const lead = await dbStore.leads.findOne(m.recordId);
      if (lead) {
        name = lead.company || lead.email || "Unknown";
        email = lead.email || "prospect@example.com";
      }
    } else if (m.recordType === "contact") {
      const contact = await dbStore.contacts.findOne(m.recordId);
      if (contact) {
        name = `${contact.firstName} ${contact.lastName}`.trim() || "Unknown";
        email = contact.email || "prospect@example.com";
      }
    }

    data.push({
      membershipId: m.id,
      recordType: m.recordType,
      recordId: m.recordId,
      recordName: name,
      email,
      status: m.status,
      engagementScore: m.engagementScore ?? 0,
    });
  }

  return c.json({ success: true, data });
});

app.post(
  "/api/sequences/members/:id/recalculate-score",
  tenantAuth,
  async (c) => {
    const membershipId = c.req.param("id");
    const membership =
      await dbStore.marketingSequenceMemberships.findOne(membershipId);
    if (!membership) {
      return c.json({ success: false, error: "Membership not found" }, 404);
    }

    const score = await recalculateMemberEngagementScore(membershipId);
    return c.json({
      success: true,
      message: "Engagement score recalculated successfully",
      engagementScore: score,
    });
  },
);

app.post("/api/sequences/:id/triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const body = await c.req.json();
  const tenant = c.get("tenant");
  const orgId = tenant.orgId;

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const trigger = await dbStore.marketingSequenceScoreTriggers.insert({
    orgId,
    sequenceId,
    scoreThreshold: Number(body.scoreThreshold ?? 0),
    actionType: body.actionType,
    actionConfig: body.actionConfig || {},
  });

  return c.json({ success: true, data: trigger }, 201);
});

app.get("/api/sequences/:id/triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const triggers =
    await dbStore.marketingSequenceScoreTriggers.findForSequence(sequenceId);
  return c.json({ success: true, data: triggers });
});

app.delete("/api/sequences/triggers/:id", tenantAuth, async (c) => {
  const triggerId = c.req.param("id");
  const trigger =
    await dbStore.marketingSequenceScoreTriggers.findOne(triggerId);
  if (!trigger) {
    return c.json({ success: false, error: "Trigger not found" }, 404);
  }

  const success =
    await dbStore.marketingSequenceScoreTriggers.delete(triggerId);
  if (!success) {
    return c.json({ success: false, error: "Trigger not found" }, 404);
  }

  return c.json({
    success: true,
    message: "Score trigger deleted successfully",
  });
});

// Folder & Tag Categorization Endpoints

app.post("/api/sequences/folders", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, parentFolderId } = body;

  if (!name) {
    return c.json({ success: false, error: "Folder name is required" }, 400);
  }

  // 1. Verify parent folder if provided
  if (parentFolderId) {
    const parentFolder =
      await dbStore.marketingSequenceFolders.findOne(parentFolderId);
    if (!parentFolder) {
      return c.json({ success: false, error: "Parent folder not found" }, 400);
    }
  }

  // 2. Check for unique name under same parent
  const allFolders = await dbStore.marketingSequenceFolders.findMany();
  const duplicateName = allFolders.some(
    (f) =>
      f.name.toLowerCase() === name.toLowerCase() &&
      f.parentFolderId === (parentFolderId || null),
  );
  if (duplicateName) {
    return c.json(
      {
        success: false,
        error: "A folder with this name already exists in this location",
      },
      400,
    );
  }

  const folder = await dbStore.marketingSequenceFolders.insert({
    orgId: tenant.orgId,
    name,
    parentFolderId: parentFolderId || null,
  });

  return c.json({ success: true, folder });
});

app.patch("/api/sequences/folders/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, parentFolderId } = body;

  const folder = await dbStore.marketingSequenceFolders.findOne(id);
  if (!folder) {
    return c.json({ success: false, error: "Folder not found" }, 404);
  }

  const updates: Record<string, unknown> = {};

  if (parentFolderId !== undefined) {
    if (parentFolderId !== null) {
      // a. Verify parent exists
      const parentFolder =
        await dbStore.marketingSequenceFolders.findOne(parentFolderId);
      if (!parentFolder) {
        return c.json(
          { success: false, error: "Parent folder not found" },
          400,
        );
      }
      // b. Detect loops using core function
      const allFolders = await dbStore.marketingSequenceFolders.findMany();
      const hasLoop = detectFolderLoop(
        id,
        parentFolderId,
        allFolders.map((f) => ({
          id: f.id,
          parentFolderId: f.parentFolderId,
        })),
      );
      if (hasLoop) {
        return c.json(
          { success: false, error: "Recursive folder loop detected" },
          400,
        );
      }
      updates.parentFolderId = parentFolderId;
    } else {
      updates.parentFolderId = null;
    }
  }

  if (name) {
    // Check uniqueness
    const parentIdToCheck =
      parentFolderId !== undefined ? parentFolderId : folder.parentFolderId;
    const allFolders = await dbStore.marketingSequenceFolders.findMany();
    const duplicateName = allFolders.some(
      (f) =>
        f.id !== id &&
        f.name.toLowerCase() === name.toLowerCase() &&
        f.parentFolderId === (parentIdToCheck || null),
    );
    if (duplicateName) {
      return c.json(
        {
          success: false,
          error: "A folder with this name already exists in this location",
        },
        400,
      );
    }
    updates.name = name;
  }

  const updated = await dbStore.marketingSequenceFolders.update(id, updates);
  return c.json({ success: true, folder: updated });
});

app.get("/api/sequences/folders", tenantAuth, async (c) => {
  const folders = await dbStore.marketingSequenceFolders.findMany();
  return c.json({ success: true, data: folders });
});

app.post("/api/sequences/tags", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, color } = body;

  if (!name || !color) {
    return c.json(
      { success: false, error: "Name and color are required" },
      400,
    );
  }

  if (!validateHexColor(color)) {
    return c.json(
      { success: false, error: "Invalid hex color code format" },
      400,
    );
  }

  const allTags = await dbStore.marketingSequenceTags.findMany();
  const duplicate = allTags.some(
    (t) => t.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    return c.json({ success: false, error: "Tag already exists" }, 400);
  }

  const tag = await dbStore.marketingSequenceTags.insert({
    orgId: tenant.orgId,
    name,
    color,
  });

  return c.json({ success: true, tag });
});

app.get("/api/sequences/tags", tenantAuth, async (c) => {
  const tags = await dbStore.marketingSequenceTags.findMany();
  return c.json({ success: true, data: tags });
});

app.post("/api/sequences/:id/tags", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { tagId } = body;

  if (!tagId) {
    return c.json({ success: false, error: "tagId is required" }, 400);
  }

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const tag = await dbStore.marketingSequenceTags.findOne(tagId);
  if (!tag) {
    return c.json({ success: false, error: "Tag not found" }, 404);
  }

  const existingMappings =
    await dbStore.marketingSequenceTagMappings.findForSequence(sequenceId);
  const alreadyMapped = existingMappings.some((m) => m.tagId === tagId);
  if (alreadyMapped) {
    return c.json({
      success: true,
      message: "Tag already mapped to sequence",
    });
  }

  const mapping = await dbStore.marketingSequenceTagMappings.insert({
    orgId: tenant.orgId,
    sequenceId,
    tagId,
  });

  return c.json({ success: true, mapping });
});

app.delete("/api/sequences/:id/tags/:tagId", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tagId = c.req.param("tagId");

  const deleted =
    await dbStore.marketingSequenceTagMappings.deleteForSequenceAndTag(
      sequenceId,
      tagId,
    );
  if (!deleted) {
    return c.json({ success: false, error: "Mapping not found" }, 404);
  }

  return c.json({
    success: true,
    message: "Tag detached from sequence successfully",
  });
});

app.get("/api/sequences", tenantAuth, async (c) => {
  const folderId = c.req.query("folderId");
  const tagId = c.req.query("tagId");

  let sequences = await dbStore.marketingSequences.findMany();

  if (folderId) {
    sequences = sequences.filter((s) => s.folderId === folderId);
  }

  if (tagId) {
    const mappings = await dbStore.marketingSequenceTagMappings.findMany();
    const sequenceIdsWithTag = mappings
      .filter((m) => m.tagId === tagId)
      .map((m) => m.sequenceId);
    sequences = sequences.filter((s) => sequenceIdsWithTag.includes(s.id));
  }

  return c.json({ success: true, data: sequences });
});

app.get("/api/sequences/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const sequence = await dbStore.marketingSequences.findOne(id);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const mappings =
    await dbStore.marketingSequenceTagMappings.findForSequence(id);
  const tags = [];
  for (const m of mappings) {
    const tag = await dbStore.marketingSequenceTags.findOne(m.tagId);
    if (tag) tags.push(tag);
  }

  let folderName = null;
  if (sequence.folderId) {
    const folder = await dbStore.marketingSequenceFolders.findOne(
      sequence.folderId,
    );
    if (folder) folderName = folder.name;
  }

  return c.json({
    success: true,
    data: {
      ...sequence,
      folderName,
      tags,
    },
  });
});

app.post("/api/sequences/:id/clone", tenantAuth, async (c) => {
  const originalId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name } = body;

  const originalSequence = await dbStore.marketingSequences.findOne(originalId);
  if (!originalSequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const newName = name || `${originalSequence.name} - Copy`;

  try {
    const cloned = await cloneMarketingSequence(
      dbStore,
      originalId,
      newName,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: cloned });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/api/sequences/:id/pause", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    const paused = await pauseMarketingSequence(
      dbStore,
      sequenceId,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: paused });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/api/sequences/:id/resume", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    const resumed = await resumeMarketingSequence(
      dbStore,
      sequenceId,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: resumed });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/api/sequences/:id/steps/:stepId/reorder", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");
  const { newStepNumber } = await c.req.json();

  if (typeof newStepNumber !== "number") {
    return c.json({ success: false, error: "Invalid newStepNumber" }, 400);
  }

  try {
    const updatedSteps = await reorderMarketingSequenceSteps(
      dbStore,
      sequenceId,
      stepId,
      newStepNumber,
      tenant.orgId,
    );
    return c.json({ success: true, steps: updatedSteps });
  } catch (err) {
    const error = err as Error;
    if (
      error.message.includes("RLS Isolation Violation") ||
      error.message.includes("Tenant mismatch")
    ) {
      return c.json({ success: false, error: error.message }, 403);
    }
    if (error.message.includes("not found")) {
      return c.json({ success: false, error: error.message }, 404);
    }
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.delete("/api/sequences/:id/steps/:stepId", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");

  try {
    const updatedSteps = await deleteMarketingSequenceStep(
      dbStore,
      sequenceId,
      stepId,
      tenant.orgId,
    );
    return c.json({ success: true, steps: updatedSteps });
  } catch (err) {
    const error = err as Error;
    if (
      error.message.includes("RLS Isolation Violation") ||
      error.message.includes("Tenant mismatch")
    ) {
      return c.json({ success: false, error: error.message }, 403);
    }
    if (error.message.includes("not found")) {
      return c.json({ success: false, error: error.message }, 404);
    }
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.post("/api/sequences/:id/archive", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    const archived = await archiveMarketingSequence(
      dbStore,
      sequenceId,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: archived });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.delete("/api/sequences/:id/purge", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    await purgeMarketingSequence(dbStore, sequenceId, tenant.orgId);
    return c.json({ success: true, message: "Sequence purged successfully" });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

app.get("/api/sequences/:id/members/:memberId/logs", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const tenant = c.get("tenant");

  try {
    const logs = await getMarketingSequenceMemberLogs(
      dbStore,
      sequenceId,
      memberId,
      tenant.orgId,
    );
    return c.json({ success: true, data: logs });
  } catch (err) {
    const error = err as Error;
    const errorMsg = error.message || "";
    if (errorMsg.includes("RLS Isolation Violation")) {
      return c.json({ success: false, error: errorMsg }, 403);
    }
    if (errorMsg.includes("not found")) {
      return c.json({ success: false, error: errorMsg }, 404);
    }
    if (errorMsg.includes("does not belong")) {
      return c.json({ success: false, error: errorMsg }, 400);
    }
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

// Start Hono Node Server if run directly (excluding test execution environment)

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT) || 3001;
  import("@hono/node-server")
    .then(({ serve }) => {
      console.log(`[Hono API] Server is starting on port ${port}`);
      serve({
        fetch: app.fetch,
        port,
      });
    })
    .catch((err) => {
      console.error("Failed to load @hono/node-server:", err);
    });
}

export default app;
