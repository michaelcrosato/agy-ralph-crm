import { Permission } from "@crm/auth";
import { compileEmailTemplate } from "@crm/core";
import { dbStore } from "@crm/db";
import { compileFormLayout } from "@crm/metadata";
import { Hono } from "hono";
import { requirePermission } from "../middleware/rbac";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Tenant metadata: field definitions, picklist deps, validation rules, layouts. */
export const metadataApp = new Hono<Env>();
metadataApp.use("*", tenantAuth, requirePermission(Permission.MANAGE_METADATA));

metadataApp.post("/fields", tenantAuth, async (c) => {
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

metadataApp.get("/fields", tenantAuth, async (c) => {
  const fields = await dbStore.fieldDefinitions.findMany();
  return c.json({ success: true, data: fields });
});

metadataApp.post("/picklist-dependencies", tenantAuth, async (c) => {
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

metadataApp.get("/picklist-dependencies", tenantAuth, async (c) => {
  const deps = await dbStore.picklistDependencies.findMany();
  return c.json({ success: true, data: deps });
});

metadataApp.delete("/picklist-dependencies/:id", tenantAuth, async (c) => {
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

metadataApp.post("/validation-rules", tenantAuth, async (c) => {
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

metadataApp.get("/validation-rules", tenantAuth, async (c) => {
  const rules = await dbStore.validationRules.findMany();
  return c.json({ success: true, data: rules });
});

metadataApp.delete("/validation-rules/:id", tenantAuth, async (c) => {
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

metadataApp.post("/layouts/:objectType", tenantAuth, async (c) => {
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

metadataApp.get("/layouts/:objectType", tenantAuth, async (c) => {
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
metadataApp.get("/email-templates", tenantAuth, async (c) => {
  const templates = await dbStore.emailTemplates.findMany();
  return c.json({ success: true, data: templates });
});

metadataApp.post("/email-templates", tenantAuth, async (c) => {
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

metadataApp.delete("/email-templates/:id", tenantAuth, async (c) => {
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

metadataApp.post("/email-templates/:id/compile", tenantAuth, async (c) => {
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
