import { type TenantContext, verifySessionToken } from "@crm/auth";
import { convertLead } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { compileFormLayout, validateCustomFields } from "@crm/metadata";
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
  });
});

export default app;
