import { convertLeadWithMappings } from "@crm/core";
import { dbStore } from "@crm/db";
import { executeWorkflows } from "@crm/workflow";
import { OpenAPIHono } from "@hono/zod-openapi";
import { checkAndRunLeadAutoConversion } from "../../lib/leadAutoConversion";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const conversionRouter = new OpenAPIHono<Env>();

conversionRouter.use(tenantAuth);

conversionRouter.get("/auto-conversion-rules", tenantAuth, async (c) => {
  const rules = await dbStore.leadAutoConversionRules.findMany();
  return c.json({ success: true, data: rules });
});

conversionRouter.post("/auto-conversion-rules", tenantAuth, async (c) => {
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

conversionRouter.post("/:id/convert", tenantAuth, async (c) => {
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

  const mappings = await dbStore.leadConversionMappings.findMany();

  const entities = convertLeadWithMappings({
    lead,
    opportunityName,
    opportunityAmount,
    mappings,
  });

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

  let opportunityId: string | undefined;
  let workflowExecution:
    | { dispatchedWebhooks: string[]; notificationsCreated: string[] }
    | undefined;

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

  await dbStore.leads.update(id, {
    status: "Converted",
    convertedAccountId: account.id,
    convertedContactId: contact.id,
  });

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

  await triggerOutboundWebhooks(tenant.orgId, "lead.converted", {
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
