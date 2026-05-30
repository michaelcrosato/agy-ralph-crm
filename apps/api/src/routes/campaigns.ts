import {
  calculateCampaignROI,
  calculateCampaignStats,
  calculateUnsubscribeAnalytics,
  compileEmailTemplate,
  enrollSegmentInSequence,
  resolveSegmentMembers,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

export const campaignsApp = new Hono<Env>();
export const segmentsApp = new Hono<Env>();
export const unsubscribesApp = new Hono<Env>();

unsubscribesApp.get("/", tenantAuth, async (c) => {
  const unsubs = await dbStore.emailUnsubscribes.findMany();
  const sorted = unsubs.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return c.json({ success: true, data: sorted });
});

unsubscribesApp.get("/analytics", tenantAuth, async (c) => {
  const unsubscribes = await dbStore.emailUnsubscribes.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const links = await dbStore.activityLinks.findMany();
  const memberships = await dbStore.marketingSequenceMemberships.findMany();
  const sequences = await dbStore.marketingSequences.findMany();

  const analytics = calculateUnsubscribeAnalytics({
    unsubscribes,
    trackers,
    links,
    memberships,
    sequences,
  });

  return c.json({ success: true, data: analytics });
});

segmentsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, description, objectType, criteria } = body;

  if (!name) {
    return c.json({ success: false, error: "Segment name is required" }, 400);
  }

  if (!objectType || (objectType !== "lead" && objectType !== "contact")) {
    return c.json(
      { success: false, error: "objectType must be lead or contact" },
      400,
    );
  }

  if (!criteria || !Array.isArray(criteria)) {
    return c.json(
      { success: false, error: "criteria is required and must be an array" },
      400,
    );
  }

  const segment = await dbStore.marketingSegments.insert({
    orgId: tenant.orgId,
    name,
    description: description || "",
    objectType,
    criteria,
  });

  return c.json({ success: true, segment });
});

segmentsApp.get("/", tenantAuth, async (c) => {
  const segments = await dbStore.marketingSegments.findMany();
  return c.json({ success: true, data: segments });
});

segmentsApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const segment = await dbStore.marketingSegments.findOne(id);
  if (!segment) {
    return c.json({ success: false, error: "Segment not found" }, 404);
  }
  return c.json({ success: true, segment });
});

segmentsApp.delete("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const success = await dbStore.marketingSegments.delete(id);
  if (!success) {
    return c.json(
      { success: false, error: "Segment not found or delete failed" },
      404,
    );
  }
  return c.json({ success: true });
});

segmentsApp.get("/:id/members", tenantAuth, async (c) => {
  const segmentId = c.req.param("id");
  const tenant = c.get("tenant");

  try {
    const members = await resolveSegmentMembers(
      dbStore,
      tenant.orgId,
      segmentId,
    );
    return c.json({ success: true, data: members });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        success: false,
        error: msg || "Failed to resolve segment members",
      },
      404,
    );
  }
});

segmentsApp.post("/:id/enroll-sequence", tenantAuth, async (c) => {
  const segmentId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { sequenceId } = body;

  if (!sequenceId) {
    return c.json({ success: false, error: "sequenceId is required" }, 400);
  }

  try {
    const result = await enrollSegmentInSequence(
      dbStore,
      tenant.orgId,
      segmentId,
      sequenceId,
    );
    return c.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        success: false,
        error: msg || "Failed to enroll segment in sequence",
      },
      400,
    );
  }
});

campaignsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    status,
    type,
    isActive,
    startDate,
    endDate,
    budgetedCost,
    actualCost,
    expectedRevenue,
    utmSource,
    utmMedium,
    utmCampaign,
  } = body;

  if (!name) {
    return c.json({ error: "Missing required parameter: name" }, 400);
  }

  const campaign = await dbStore.campaigns.insert({
    orgId: tenant.orgId,
    name,
    status: status || "Planned",
    type: type || "Other",
    isActive: isActive !== undefined ? Number(isActive) : 1,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    budgetedCost: budgetedCost || "0.00",
    actualCost: actualCost || "0.00",
    expectedRevenue: expectedRevenue || "0.00",
    utmSource: utmSource || null,
    utmMedium: utmMedium || null,
    utmCampaign: utmCampaign || null,
  });

  return c.json({ success: true, data: campaign });
});

campaignsApp.get("/", tenantAuth, async (c) => {
  const campaignsList = await dbStore.campaigns.findMany();
  return c.json({ success: true, data: campaignsList });
});

campaignsApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const campaign = await dbStore.campaigns.findOne(id);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  // Fetch campaign members
  const members = await dbStore.campaignMembers.findForCampaign(campaign.id);

  // Fetch opportunities and filter for campaignId
  const allOpps = await dbStore.opportunities.findMany();
  const opportunities = allOpps.filter((opp) => opp.campaignId === campaign.id);

  // Calculate statistics
  const stats = calculateCampaignStats({
    budgetedCost: campaign.budgetedCost,
    actualCost: campaign.actualCost,
    expectedRevenue: campaign.expectedRevenue,
    members,
    opportunities,
  });

  return c.json({
    success: true,
    data: {
      ...campaign,
      stats,
    },
  });
});

campaignsApp.post("/:id/members", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const campaignId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { leadId, contactId, status } = body;

  const campaign = await dbStore.campaigns.findOne(campaignId);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  if (!leadId && !contactId) {
    return c.json({ error: "Must provide either leadId or contactId" }, 400);
  }

  if (leadId && contactId) {
    return c.json({ error: "Cannot provide both leadId and contactId" }, 400);
  }

  // Verify lead or contact exists and belongs to the tenant
  if (leadId) {
    const lead = await dbStore.leads.findOne(leadId);
    if (!lead) {
      return c.json({ error: "Lead not found or tenant mismatch" }, 404);
    }
  }

  if (contactId) {
    const contact = await dbStore.contacts.findOne(contactId);
    if (!contact) {
      return c.json({ error: "Contact not found or tenant mismatch" }, 404);
    }
  }

  try {
    const member = await dbStore.campaignMembers.insert({
      orgId: tenant.orgId,
      campaignId,
      leadId: leadId || null,
      contactId: contactId || null,
      status: status || "Sent",
    });
    return c.json({ success: true, data: member });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 400);
  }
});

campaignsApp.get("/:id/members", tenantAuth, async (c) => {
  const campaignId = c.req.param("id");
  const campaign = await dbStore.campaigns.findOne(campaignId);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const members = await dbStore.campaignMembers.findForCampaign(campaignId);
  return c.json({ success: true, data: members });
});

campaignsApp.post("/:id/members/:memberId/status", tenantAuth, async (c) => {
  const campaignId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const body = await c.req.json().catch(() => ({}));
  const { status } = body;

  if (!status) {
    return c.json({ error: "Missing required parameter: status" }, 400);
  }

  const campaign = await dbStore.campaigns.findOne(campaignId);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const member = await dbStore.campaignMembers.findOne(memberId);
  if (!member || member.campaignId !== campaignId) {
    return c.json({ error: "Campaign member not found" }, 404);
  }

  const updated = await dbStore.campaignMembers.update(memberId, { status });
  return c.json({ success: true, data: updated });
});

campaignsApp.post("/:id/email-blast", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const campaignId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { templateId, senderEmail } = body;

  if (!templateId) {
    return c.json({ error: "Missing required parameter: templateId" }, 400);
  }

  if (!senderEmail) {
    return c.json({ error: "Missing required parameter: senderEmail" }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(senderEmail)) {
    return c.json({ error: "Invalid 'senderEmail' format" }, 400);
  }

  const campaign = await dbStore.campaigns.findOne(campaignId);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const template = await dbStore.emailTemplates.findOne(templateId);
  if (!template) {
    return c.json({ error: "Email template not found" }, 404);
  }

  const members = await dbStore.campaignMembers.findForCampaign(campaignId);
  const emailLogs: unknown[] = [];
  let processedCount = 0;

  for (const member of members) {
    let targetEmail: string | null = null;
    const context: {
      lead?: Record<string, unknown>;
      contact?: Record<string, unknown>;
      account?: Record<string, unknown>;
      opportunity?: Record<string, unknown>;
    } = {};

    if (member.leadId) {
      const lead = await dbStore.leads.findOne(member.leadId);
      if (lead) {
        targetEmail = lead.email;
        context.lead = lead as unknown as Record<string, unknown>;
      }
    } else if (member.contactId) {
      const contact = await dbStore.contacts.findOne(member.contactId);
      if (contact) {
        targetEmail = contact.email;
        context.contact = contact as unknown as Record<string, unknown>;

        if (contact.accountId) {
          const account = await dbStore.accounts.findOne(contact.accountId);
          if (account) {
            context.account = account as unknown as Record<string, unknown>;

            // Fetch opportunities associated with the account, get the most recently updated/created one
            const allOpps = await dbStore.opportunities.findMany();
            const accountOpps = allOpps.filter(
              (opp) => opp.accountId === account.id,
            );
            if (accountOpps.length > 0) {
              const sorted = [...accountOpps].sort((a, b) => {
                const dateA = a.closeDate ? new Date(a.closeDate).getTime() : 0;
                const dateB = b.closeDate ? new Date(b.closeDate).getTime() : 0;
                return dateB - dateA;
              });
              context.opportunity = sorted[0] as unknown as Record<
                string,
                unknown
              >;
            }
          }
        }
      }
    }

    if (!targetEmail || !emailRegex.test(targetEmail)) {
      continue; // Skip members without valid emails
    }

    const compiled = compileEmailTemplate(
      { subject: template.subject, body: template.body },
      context,
    );

    const act = await dbStore.activities.insert({
      orgId: tenant.orgId,
      creatorId: tenant.userId,
      type: "email",
      subject: compiled.subject,
      body: compiled.body,
      dueDate: null,
      custom: {
        from: senderEmail,
        to: [targetEmail],
        cc: [],
        bcc: [],
      },
    });

    // Links: recipient
    await dbStore.activityLinks.insert({
      orgId: tenant.orgId,
      activityId: act.id,
      targetType: member.leadId ? "Lead" : "Contact",
      targetId: member.leadId ? member.leadId : member.contactId || "",
    });

    // Links: Campaign
    await dbStore.activityLinks.insert({
      orgId: tenant.orgId,
      activityId: act.id,
      targetType: "Campaign",
      targetId: campaignId,
    });

    // Links: Account
    if (context.account) {
      await dbStore.activityLinks.insert({
        orgId: tenant.orgId,
        activityId: act.id,
        targetType: "Account",
        targetId: context.account.id as string,
      });
    }

    // Links: Opportunity
    if (context.opportunity) {
      await dbStore.activityLinks.insert({
        orgId: tenant.orgId,
        activityId: act.id,
        targetType: "Opportunity",
        targetId: context.opportunity.id as string,
      });
    }

    // Update member status to Sent
    await dbStore.campaignMembers.update(member.id, { status: "Sent" });

    // Audit Log
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: act.id,
      recordType: "EmailLog",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });

    emailLogs.push(act);
    processedCount++;
  }

  return c.json({
    success: true,
    processedCount,
    emailLogs,
  });
});

campaignsApp.get("/:id/attribution", tenantAuth, async (c) => {
  const id = c.req.param("id");

  const influences = await dbStore.campaignInfluence.findMany();
  const campaignInfluences = influences.filter((inf) => inf.campaignId === id);

  let totalRevenue = 0;
  for (const inf of campaignInfluences) {
    const opp = await dbStore.opportunities.findOne(inf.opportunityId);
    if (opp && opp.stage === "Closed Won") {
      totalRevenue += Number.parseFloat(inf.revenueShare) || 0;
    }
  }

  return c.json({
    success: true,
    data: {
      totalRevenueAttributed: totalRevenue.toFixed(2),
    },
  });
});

campaignsApp.get("/:id/roi", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const campaign = await dbStore.campaigns.findOne(id);
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const members = await dbStore.campaignMembers.findForCampaign(id);
  const influences = await dbStore.campaignInfluence.findMany();
  const campaignInfluences = influences.filter((inf) => inf.campaignId === id);

  const opportunities = await dbStore.opportunities.findMany();
  const wonOpportunityIds = new Set(
    opportunities
      .filter((opp) => opp.stage === "Closed Won")
      .map((opp) => opp.id),
  );

  const metrics = calculateCampaignROI({
    campaign,
    members,
    influences: campaignInfluences,
    wonOpportunityIds,
  });

  return c.json({
    success: true,
    data: metrics,
  });
});
