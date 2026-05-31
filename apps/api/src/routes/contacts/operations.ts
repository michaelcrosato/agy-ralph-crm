import {
  AIAttributeService,
  calculateContactDuplicates,
  mergeContacts,
} from "@crm/core";
import { dbStore, store } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const operationsApp = new Hono<Env>();

operationsApp.get("/:id/duplicates", tenantAuth, async (c) => {
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

operationsApp.post("/:id/merge", tenantAuth, async (c) => {
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

  const mergedContact = mergeContacts({ master, duplicate, fieldResolution });

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

  for (const ticket of store.tickets) {
    if (ticket.orgId === tenant.orgId && ticket.contactId === duplicateId) {
      ticket.contactId = id;
    }
  }

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
      const idx = store.campaignMembers.findIndex((m) => m.id === dupMember.id);
      if (idx !== -1) {
        store.campaignMembers.splice(idx, 1);
      }
    } else {
      dupMember.contactId = id;
    }
  }

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

  for (const link of store.activityLinks) {
    if (
      link.orgId === tenant.orgId &&
      link.targetType === "Contact" &&
      link.targetId === duplicateId
    ) {
      link.targetId = id;
    }
  }

  for (const cRecord of store.contacts) {
    if (cRecord.orgId === tenant.orgId && cRecord.reportsToId === duplicateId) {
      cRecord.reportsToId = id;
    }
  }

  await dbStore.contacts.delete(duplicateId);

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

  await triggerOutboundWebhooks(tenant.orgId, "contact.merged", {
    contactId: id,
    mergedContactId: duplicateId,
    finalContact: updatedMaster,
  });

  return c.json({ success: true, data: updatedMaster });
});

operationsApp.post("/:id/enrich", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const tenant = c.get("tenant");
  try {
    const enriched = await AIAttributeService.enrichRecord(
      "contact",
      id,
      tenant.orgId,
    );
    return c.json({ success: true, data: enriched });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});
