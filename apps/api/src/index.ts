import { type TenantContext, verifySessionToken } from "@crm/auth";
import { convertLead, rollupOpportunityAmount } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { compileFormLayout, validateCustomFields } from "@crm/metadata";
import { createTicket, resolveTicket } from "@crm/module-service-lite";
import { runReport } from "@crm/reporting";
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
  try {
    const tenantContext = await verifySessionToken(token);
    c.set("tenant", tenantContext);

    // Propagate context database-level via RLS transaction wrapper
    return await withTenant(tenantContext.orgId, mockDb, async () => {
      return await next();
    });
  } catch (err) {
    return c.json({ error: "Unauthorized: Token verification failed" }, 401);
  }
});

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

export default app;
