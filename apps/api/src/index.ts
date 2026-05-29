import {
  type TenantContext,
  createSessionToken,
  verifySessionToken,
} from "@crm/auth";
import {
  calculateCPQPrice,
  calculateCampaignStats,
  calculateOpportunityCommission,
  calculateOpportunitySplits,
  calculateProRatedAmount,
  calculateStageVelocity,
  convertLead,
  evaluateLeadAssignment,
  evaluateTerritoryRouting,
  rollupOpportunityAmount,
  validateEmailLogInput,
  validateOpportunityApprovalSubmission,
} from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { compileTemplate } from "@crm/documents";
import { compileForecastSummary } from "@crm/forecasting";
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

app.get("/mcp/tools", (c) => c.json({ tools: mcpTools }));

// Model Context Protocol (MCP) Tool Call Executor Route
app.post("/mcp/tools/call", tenantAuth, async (c) => {
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

  return c.json({ success: true, data: newLead });
});

app.get("/api/leads", tenantAuth, async (c) => {
  const leads = await dbStore.leads.findMany();
  return c.json({ success: true, data: leads });
});

app.get("/api/leads/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }
  return c.json({ success: true, data: lead });
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

  // Pure mapping via @crm/core
  const entities = convertLead({
    lead,
    opportunityName,
    opportunityAmount,
  });

  // DB inserts with correct tenant active context
  const account = await dbStore.accounts.insert({
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    name: entities.account.name,
    domain: null,
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
      closeDate: null,
      custom: null,
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

app.get("/api/accounts/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  return c.json({ success: true, data: account });
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

// Opportunities Pipeline & Stage Management REST API Endpoints
app.get("/api/opportunities", tenantAuth, async (c) => {
  const opportunities = await dbStore.opportunities.findMany();
  return c.json({ success: true, data: opportunities });
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
  const { name, stage, accountId, amount, closeDate } = body;

  if (!name || !stage || !accountId) {
    return c.json({ error: "Missing required opportunity parameters" }, 400);
  }

  const opp = await dbStore.opportunities.insert({
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    accountId,
    name,
    stage,
    amount: amount !== undefined ? String(amount) : null,
    closeDate: closeDate ? new Date(closeDate) : null,
    custom: null,
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
  const { name, stage, amount, closeDate } = body;

  const existing = await dbStore.opportunities.findOne(id);
  if (!existing) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const updates: Parameters<typeof dbStore.opportunities.update>[1] = {};
  if (name !== undefined) updates.name = name;
  if (stage !== undefined) updates.stage = stage;
  if (amount !== undefined)
    updates.amount = amount !== null ? String(amount) : null;
  if (closeDate !== undefined)
    updates.closeDate = closeDate !== null ? new Date(closeDate) : null;

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
