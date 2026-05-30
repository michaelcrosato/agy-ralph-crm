import { evaluateLeadAssignment, evaluateTicketAssignment } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { validateCustomFields } from "@crm/metadata";
import { Hono } from "hono";
import { checkAndRunLeadAutoConversion } from "../lib/leadAutoConversion";
import { triggerOutboundWebhooks } from "../lib/webhooks";

/** Public unauthenticated webhooks: web-to-lead and web-to-ticket. */
export const publicApp = new Hono();

publicApp.post("/web-to-lead", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { orgId, lastName, email, firstName, company, custom, ownerId } = body;

  if (!orgId || !lastName || !email) {
    return c.json(
      { error: "Missing required fields: orgId, lastName, email" },
      400,
    );
  }

  return await withTenant(orgId, mockDb, async () => {
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

    let resolvedOwnerId = ownerId || null;

    const rules = await dbStore.leadAssignmentRules.findMany();
    const activeRule = rules.find((r) => r.isActive === 1);

    if (activeRule) {
      const allEntries = await dbStore.leadAssignmentRuleEntries.findMany();
      const activeEntries = allEntries
        .filter((e) => e.ruleId === activeRule.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (activeEntries.length > 0) {
        const evalLead = {
          firstName: firstName || null,
          lastName,
          email,
          company: company || null,
          custom: custom || null,
        };
        const matchResult = evaluateLeadAssignment(evalLead, activeEntries);
        if (matchResult) {
          resolvedOwnerId = matchResult.newOwnerId;

          const matchedEntry = activeEntries.find(
            (e) => e.id === matchResult.matchedEntryId,
          );
          if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
            await dbStore.leadAssignmentRuleEntries.update(matchedEntry.id, {
              lastAssignedIndex: matchResult.newLastAssignedIndex,
            });
          }
        }
      }
    }

    if (!resolvedOwnerId) {
      resolvedOwnerId = "user-system";
    }

    const newLead = await dbStore.leads.insert({
      orgId,
      ownerId: resolvedOwnerId,
      status: "New",
      email,
      company: company || null,
      convertedAccountId: null,
      convertedContactId: null,
      custom: custom || null,
    });

    await dbStore.auditLogs.insert({
      orgId,
      recordId: newLead.id,
      recordType: "Lead",
      action: "create",
      userId: resolvedOwnerId,
      changes: null,
    });

    await triggerOutboundWebhooks(orgId, "lead.created", {
      id: newLead.id,
      orgId,
      ownerId: resolvedOwnerId,
      status: "New",
      email,
      company: company || null,
      custom: custom || null,
    });

    const autoConvertResult = await checkAndRunLeadAutoConversion(
      newLead.id,
      orgId,
      resolvedOwnerId,
    );

    return c.json(
      {
        success: true,
        data: newLead,
        autoConverted: autoConvertResult || null,
      },
      201,
    );
  });
});

publicApp.post("/web-to-ticket", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    orgId,
    subject,
    body: ticketBody,
    email,
    firstName,
    lastName,
    priority,
    custom,
    assignedToId,
  } = body;

  if (!orgId || !subject || !ticketBody || !email) {
    return c.json(
      { error: "Missing required fields: orgId, subject, body, email" },
      400,
    );
  }

  return await withTenant(orgId, mockDb, async () => {
    if (custom && typeof custom === "object") {
      const allDefs = await dbStore.fieldDefinitions.findMany();
      const ticketDefs = allDefs.filter((def) => def.objectType === "tickets");
      const validation = validateCustomFields(
        custom,
        ticketDefs.map((def) => ({
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

    let contactId = "";
    let contactCreated = false;

    const contacts = await dbStore.contacts.findMany();
    const existingContact = contacts.find((ct) => ct.email === email);

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const newContact = await dbStore.contacts.insert({
        orgId,
        email,
        firstName: firstName || null,
        lastName: lastName || "Web Contact",
        custom: null,
        accountId: null,
        ownerId: "user-system",
      });
      contactId = newContact.id;
      contactCreated = true;

      await dbStore.auditLogs.insert({
        orgId,
        recordId: contactId,
        recordType: "Contact",
        action: "create",
        userId: "user-system",
        changes: null,
      });
    }

    let resolvedAssignedToId = assignedToId || null;

    const rules = await dbStore.ticketAssignmentRules.findMany();
    const activeRule = rules.find((r) => r.isActive === 1);

    if (activeRule) {
      const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
      const activeEntries = allEntries
        .filter((e) => e.ruleId === activeRule.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (activeEntries.length > 0) {
        const evalTicket = {
          subject,
          body: ticketBody,
          priority: priority || "Medium",
          custom: custom || null,
          email,
          firstName: firstName || null,
          lastName: lastName || "Web Contact",
        };

        const matchResult = evaluateTicketAssignment(evalTicket, activeEntries);
        if (matchResult) {
          resolvedAssignedToId = matchResult.newAssignedToId;

          const matchedEntry = activeEntries.find(
            (e) => e.id === matchResult.matchedEntryId,
          );
          if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
            await dbStore.ticketAssignmentRuleEntries.update(matchedEntry.id, {
              lastAssignedIndex: matchResult.newLastAssignedIndex,
            });
          }
        }
      }
    }

    if (!resolvedAssignedToId) {
      resolvedAssignedToId = "user-system";
    }

    const newTicket = await dbStore.tickets.insert({
      orgId,
      contactId,
      subject,
      status: "Open",
      priority: priority || "Medium",
      assignedToId: resolvedAssignedToId,
    });

    await dbStore.auditLogs.insert({
      orgId,
      recordId: newTicket.id,
      recordType: "Ticket",
      action: "create",
      userId: resolvedAssignedToId,
      changes: null,
    });

    await triggerOutboundWebhooks(orgId, "ticket.created", {
      id: newTicket.id,
      orgId,
      contactId,
      subject,
      body: ticketBody,
      status: "Open",
      priority: priority || "Medium",
      assignedToId: resolvedAssignedToId,
      custom: custom || null,
    });

    return c.json(
      {
        success: true,
        data: newTicket,
        contactCreated,
      },
      201,
    );
  });
});
publicApp.post("/campaigns/:id/track-utm", async (c) => {
  const campaignId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { utmSource, utmMedium, utmCampaign, leadId, contactId } = body;

  // biome-ignore lint/suspicious/noExplicitAny: findOnePublic bypasses active tenant RLS for public analytics ingest
  const campaign = await (dbStore.campaigns as any).findOnePublic(campaignId);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const orgId = campaign.orgId;

  await withTenant(orgId, mockDb, async () => {
    // 1. Record CRM activity of type 'task' indicating campaign click
    if (dbStore.activities) {
      await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject: `UTM Campaign Link Click: ${utmCampaign || "none"}`,
        body: `UTM Engagement Details:\nSource: ${utmSource || "none"}\nMedium: ${utmMedium || "none"}\nCampaign: ${utmCampaign || "none"}`,
        dueDate: null,
        custom: { utmSource, utmMedium, utmCampaign },
      });
    }

    // 2. Upsert Campaign Member status to 'Responded' if leadId or contactId is provided
    if (dbStore.campaignMembers && (leadId || contactId)) {
      const existingMembers =
        await dbStore.campaignMembers.findForCampaign(campaignId);
      const member = existingMembers.find(
        (m) =>
          (leadId && m.leadId === leadId) ||
          (contactId && m.contactId === contactId),
      );

      if (member) {
        await dbStore.campaignMembers.update(member.id, {
          status: "Responded",
        });
      } else {
        await dbStore.campaignMembers.insert({
          orgId,
          campaignId,
          leadId: leadId || null,
          contactId: contactId || null,
          status: "Responded",
        });
      }
    }
  });

  return c.json({ success: true });
});
