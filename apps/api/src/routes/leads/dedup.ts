import { calculateLeadDuplicates, mergeLeads } from "@crm/core";
import { dbStore, store } from "@crm/db";
import { OpenAPIHono } from "@hono/zod-openapi";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const dedupRouter = new OpenAPIHono<Env>();

dedupRouter.use(tenantAuth);

dedupRouter.get("/:id/duplicates", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const sourceLead = await dbStore.leads.findOne(id);
  if (!sourceLead) {
    return c.json({ error: "Lead not found" }, 404);
  }
  const allLeads = await dbStore.leads.findMany();
  const duplicates = calculateLeadDuplicates(sourceLead, allLeads);
  return c.json({ success: true, data: duplicates });
});

dedupRouter.post("/:id/merge", tenantAuth, async (c) => {
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

  await triggerOutboundWebhooks(tenant.orgId, "lead.merged", {
    leadId: id,
    mergedLeadId: duplicateId,
    finalLead: updatedMaster,
  });

  return c.json({ success: true, data: updatedMaster });
});
