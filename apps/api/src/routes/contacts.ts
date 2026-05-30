import {
  calculateContactDuplicates,
  detectCircularContactRelation,
  mergeContacts,
} from "@crm/core";
import { dbStore, store } from "@crm/db";
import { Hono } from "hono";
import {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "../lib/validation";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Contact CRUD + hierarchy + duplicates + merge. Mounted at /api/contacts. */
export const contactsApp = new Hono<Env>();

contactsApp.get("/", tenantAuth, async (c) => {
  const contacts = await dbStore.contacts.findMany();
  return c.json({ success: true, data: contacts });
});

contactsApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const contact = await dbStore.contacts.findOne(id);
  if (!contact) {
    return c.json({ error: "Contact not found" }, 404);
  }
  return c.json({ success: true, data: contact });
});

contactsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { accountId, firstName, lastName, email, custom, reportsToId } = body;

  if (!lastName) {
    return c.json({ error: "Missing required parameter: lastName" }, 400);
  }

  const pldValidation = await enforcePicklistDependencies("contacts", {
    ...body,
    ...(custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

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

contactsApp.patch("/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const existing = await dbStore.contacts.findOne(id);
  if (!existing) {
    return c.json({ error: "Contact not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));

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
      const manager = await dbStore.contacts.findOne(reportsToId);
      if (!manager) {
        return c.json({ error: "Manager contact not found" }, 400);
      }

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

    await triggerOutboundWebhooks(tenant.orgId, "contact.hierarchy_updated", {
      contactId: id,
      oldReportsToId: existing.reportsToId,
      newReportsToId: updates.reportsToId || null,
    });
  } else {
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

contactsApp.get("/:id/duplicates", tenantAuth, async (c) => {
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

contactsApp.post("/:id/merge", tenantAuth, async (c) => {
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

contactsApp.get("/:id/hierarchy", tenantAuth, async (c) => {
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
