import { type TenantContext, verifySessionToken } from "@crm/auth";
import {
  calculateCPQPrice,
  calculateProRatedAmount,
  convertLead,
  rollupOpportunityAmount,
} from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { compileTemplate } from "@crm/documents";
import { compileForecastSummary } from "@crm/forecasting";
import { compileFormLayout, validateCustomFields } from "@crm/metadata";
import { createTicket, resolveTicket } from "@crm/module-service-lite";
import { runReport } from "@crm/reporting";
import { globalFuzzySearch } from "@crm/search";
import { simulateWebhookDispatch } from "@crm/webhooks";
import { executeWorkflows } from "@crm/workflow";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

type Env = {
  Variables: {
    tenant: TenantContext;
  };
};

const app = new Hono<Env>();

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
  // Query all active webhooks for this tenant under RLS context
  await withTenant(orgId, mockDb, async () => {
    const activeSubs = await dbStore.webhooks.findMany().catch(() => []);
    for (const sub of activeSubs) {
      if (sub.status === "active") {
        simulateWebhookDispatch({
          targetUrl: sub.targetUrl,
          secret: sub.secret,
          event,
          payload,
        })
          .then(async (result) => {
            // Log outcome in delivery history log
            await withTenant(orgId, mockDb, async () => {
              await dbStore.webhookDeliveries.insert({
                orgId,
                webhookId: sub.id,
                event,
                statusCode: result.statusCode,
                payload: result.payloadString,
              });
            }).catch(() => {});
          })
          .catch(() => {});
      }
    }
  });
}

app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

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

  return c.json({ success: true, data: opp });
});

app.patch("/api/opportunities/:id", tenantAuth, async (c) => {
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

export default app;
