import { setPrimaryOpportunityContactRole } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../../lib/webhooks";
import { type Env, tenantAuth } from "../../../middleware/tenantAuth";

export const contactRolesApp = new Hono<Env>();

contactRolesApp.get("/:id/contact-roles", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const roles = await dbStore.opportunityContactRoles.findForOpportunity(id);
  return c.json({ success: true, data: roles });
});

contactRolesApp.post("/:id/contact-roles", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { contactId, role, isPrimary } = body;

  if (!contactId || !role) {
    return c.json(
      { error: "Missing required parameters: contactId or role" },
      400,
    );
  }

  const contact = await dbStore.contacts.findOne(contactId);
  if (!contact) {
    return c.json({ error: "Contact not found" }, 404);
  }

  const existing = await dbStore.opportunityContactRoles.findForOpportunity(id);
  const hasDuplicate = existing.some((r) => r.contactId === contactId);
  if (hasDuplicate) {
    return c.json(
      { error: "Contact is already assigned to this opportunity" },
      400,
    );
  }

  if (isPrimary) {
    const updatedRoles = setPrimaryOpportunityContactRole(
      existing,
      id,
      contactId,
    );
    for (const r of updatedRoles) {
      if (!r.isPrimary && existing.find((x) => x.id === r.id)?.isPrimary) {
        await dbStore.opportunityContactRoles.update(r.id, {
          isPrimary: false,
        });
      }
    }
  }

  const newRole = await dbStore.opportunityContactRoles.insert({
    orgId: tenant.orgId,
    opportunityId: id,
    contactId,
    role,
    isPrimary: !!isPrimary,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "add_contact_role",
    userId: tenant.userId,
    changes: {
      contactRole: { before: null, after: newRole },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "opportunity.contact_role.created",
    {
      orgId: tenant.orgId,
      opportunityId: id,
      contactId,
      roleId: newRole.id,
      role,
      isPrimary: !!isPrimary,
    },
  );

  return c.json({ success: true, data: newRole });
});

contactRolesApp.put("/:id/contact-roles/:roleId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const roleId = c.req.param("roleId");

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const currentRole = await dbStore.opportunityContactRoles.findOne(roleId);
  if (!currentRole || currentRole.opportunityId !== id) {
    return c.json({ error: "Contact role not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { role, isPrimary } = body;

  const updates: Partial<
    Omit<typeof currentRole, "id" | "orgId" | "createdAt">
  > = {};
  if (role !== undefined) updates.role = role;
  if (isPrimary !== undefined) updates.isPrimary = !!isPrimary;

  if (isPrimary) {
    const existing =
      await dbStore.opportunityContactRoles.findForOpportunity(id);
    const updatedRoles = setPrimaryOpportunityContactRole(
      existing,
      id,
      currentRole.contactId,
    );
    for (const r of updatedRoles) {
      if (!r.isPrimary && existing.find((x) => x.id === r.id)?.isPrimary) {
        await dbStore.opportunityContactRoles.update(r.id, {
          isPrimary: false,
        });
      }
    }
  }

  const updatedRole = await dbStore.opportunityContactRoles.update(
    roleId,
    updates,
  );

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "update_contact_role",
    userId: tenant.userId,
    changes: {
      contactRole: { before: currentRole, after: updatedRole },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "opportunity.contact_role.updated",
    {
      orgId: tenant.orgId,
      opportunityId: id,
      contactId: currentRole.contactId,
      roleId,
      role: updatedRole?.role,
      isPrimary: updatedRole?.isPrimary,
    },
  );

  return c.json({ success: true, data: updatedRole });
});

contactRolesApp.delete("/:id/contact-roles/:roleId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const roleId = c.req.param("roleId");

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const currentRole = await dbStore.opportunityContactRoles.findOne(roleId);
  if (!currentRole || currentRole.opportunityId !== id) {
    return c.json({ error: "Contact role not found" }, 404);
  }

  await dbStore.opportunityContactRoles.delete(roleId);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "remove_contact_role",
    userId: tenant.userId,
    changes: {
      contactRole: { before: currentRole, after: null },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "opportunity.contact_role.deleted",
    {
      orgId: tenant.orgId,
      opportunityId: id,
      contactId: currentRole.contactId,
      roleId,
    },
  );

  return c.json({ success: true });
});
