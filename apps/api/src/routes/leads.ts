import {
  calculateLeadDuplicates,
  calculateSlaStatus,
  convertLeadWithMappings,
  mergeLeads,
} from "@crm/core";
import { dbStore, store } from "@crm/db";
import { validateCustomFields } from "@crm/metadata";
import { executeWorkflows } from "@crm/workflow";
import { Hono } from "hono";
import { checkAndRunLeadAutoConversion } from "../lib/leadAutoConversion";
import {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "../lib/validation";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Lead CRUD + SLA + duplicates + merge + convert. Mounted at /api/leads. */
export const leadsApp = new Hono<Env>();

leadsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { email, company, status, custom } = body;

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

  const pldValidation = await enforcePicklistDependencies("leads", {
    ...body,
    ...(custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

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

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newLead.id,
    recordType: "Lead",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  triggerOutboundWebhooks(
    tenant.orgId,
    "lead.created",
    newLead as unknown as Record<string, unknown>,
  );

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

leadsApp.get("/", tenantAuth, async (c) => {
  const leads = await dbStore.leads.findMany();
  return c.json({ success: true, data: leads });
});

leadsApp.get("/auto-conversion-rules", tenantAuth, async (c) => {
  const rules = await dbStore.leadAutoConversionRules.findMany();
  return c.json({ success: true, data: rules });
});

leadsApp.post("/auto-conversion-rules", tenantAuth, async (c) => {
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

leadsApp.post("/sla-targets", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { maxResponseTimeMinutes } = body;

  const targetMinutes =
    maxResponseTimeMinutes !== undefined ? Number(maxResponseTimeMinutes) : 60;

  const existingTargets = await dbStore.leadSlaTargets.findMany();
  for (const t of existingTargets) {
    if (t.isActive === 1) {
      await dbStore.leadSlaTargets.update(t.id, { isActive: 0 });
    }
  }

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

leadsApp.get("/sla-targets", tenantAuth, async (c) => {
  const targets = await dbStore.leadSlaTargets.findMany();
  const activeTarget = targets.find((t) => t.isActive === 1);
  return c.json({ success: true, data: activeTarget || null });
});

leadsApp.get("/sla-breaches", tenantAuth, async (c) => {
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

  const reloaded = await dbStore.leadSlaTrackers.findMany();
  const breached = reloaded.filter((t) => t.status === "Breached");

  return c.json({ success: true, data: breached });
});

leadsApp.post("/:id/respond", tenantAuth, async (c) => {
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

leadsApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }
  return c.json({ success: true, data: lead });
});

leadsApp.patch("/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { email, company, status, custom } = body;

  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }

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

leadsApp.get("/:id/duplicates", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const sourceLead = await dbStore.leads.findOne(id);
  if (!sourceLead) {
    return c.json({ error: "Lead not found" }, 404);
  }
  const allLeads = await dbStore.leads.findMany();
  const duplicates = calculateLeadDuplicates(sourceLead, allLeads);
  return c.json({ success: true, data: duplicates });
});

leadsApp.post("/:id/merge", tenantAuth, async (c) => {
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

  const mergedLead = mergeLeads({ master, duplicate, fieldResolution });

  const updatedMaster = await dbStore.leads.update(id, {
    email: mergedLead.email,
    company: mergedLead.company,
    status: mergedLead.status,
    custom: mergedLead.custom,
  });

  if (!updatedMaster) {
    return c.json({ error: "Failed to update master lead" }, 500);
  }

  for (const link of store.activityLinks) {
    if (
      link.orgId === tenant.orgId &&
      link.targetType === "Lead" &&
      link.targetId === duplicateId
    ) {
      link.targetId = id;
    }
  }

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
      const idx = store.campaignMembers.findIndex((m) => m.id === dupMember.id);
      if (idx !== -1) {
        store.campaignMembers.splice(idx, 1);
      }
    } else {
      dupMember.leadId = id;
    }
  }

  await dbStore.leads.delete(duplicateId);

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

  triggerOutboundWebhooks(tenant.orgId, "lead.merged", {
    leadId: id,
    mergedLeadId: duplicateId,
    finalLead: updatedMaster,
  });

  return c.json({ success: true, data: updatedMaster });
});

leadsApp.post("/:id/convert", tenantAuth, async (c) => {
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
