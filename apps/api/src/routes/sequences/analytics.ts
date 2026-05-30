import {
  calculateBounceAnalytics,
  calculateLinkEngagementAnalytics,
  calculateOpenAnalytics,
  calculateReadTimeAnalytics,
  calculateReplyAnalytics,
  calculateSequenceAnalytics,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";
import { recalculateMemberEngagementScore } from "./helpers";

export const analyticsApp = new Hono<Env>();

analyticsApp.get("/:id/analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const emailTrackers = await dbStore.emailTrackers.findMany();

  const analytics = calculateSequenceAnalytics({
    sequenceId,
    steps,
    memberships,
    activities,
    activityLinks,
    emailTrackers,
  });

  return c.json({ success: true, data: analytics });
});

analyticsApp.get("/:id/conversion-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const conversions =
    await dbStore.marketingSequenceConversions.findForSequence(sequenceId);

  const totalEnrolled = memberships.length;
  const convertedCount = conversions.length;
  const conversionRate =
    totalEnrolled > 0
      ? `${((convertedCount / totalEnrolled) * 100).toFixed(2)}%`
      : "0.00%";

  const totalAttributedRevenue = conversions
    .reduce((sum, conv) => {
      const amt = Number.parseFloat(conv.attributedRevenue || "0.00");
      return sum + (Number.isNaN(amt) ? 0 : amt);
    }, 0)
    .toFixed(2);

  // Calculate average days to convert
  let totalDays = 0;
  let convertTimeCount = 0;

  for (const conv of conversions) {
    const memb = memberships.find((m) => m.id === conv.membershipId);
    if (memb?.createdAt) {
      const diffMs =
        new Date(conv.convertedAt).getTime() -
        new Date(memb.createdAt).getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      totalDays += diffDays;
      convertTimeCount++;
    }
  }

  const averageDaysToConvert =
    convertTimeCount > 0
      ? Number.parseFloat((totalDays / convertTimeCount).toFixed(2))
      : 0;

  return c.json({
    success: true,
    data: {
      sequenceId,
      totalEnrolled,
      convertedCount,
      conversionRate,
      totalAttributedRevenue,
      averageDaysToConvert,
    },
  });
});

analyticsApp.get("/:id/links-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const clicks = await dbStore.emailClickEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateLinkEngagementAnalytics({
    clicks,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

analyticsApp.get("/:id/opens-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const opens = await dbStore.emailOpenEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateOpenAnalytics({
    opens,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

analyticsApp.get("/:id/replies-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const replies = await dbStore.emailReplyEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateReplyAnalytics({
    replies,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

analyticsApp.get("/:id/bounces-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const bounces = await dbStore.emailBounceEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateBounceAnalytics({
    bounces,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

analyticsApp.get("/:id/read-time-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const readTimeEvents = await dbStore.emailReadTimeEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateReadTimeAnalytics({
    readTimeEvents,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

analyticsApp.get("/:id/engagement-scores", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);

  const data = [];
  for (const m of memberships) {
    let name = "Unknown";
    let email = "prospect@example.com";

    if (m.recordType === "lead") {
      const lead = await dbStore.leads.findOne(m.recordId);
      if (lead) {
        name = lead.company || lead.email || "Unknown";
        email = lead.email || "prospect@example.com";
      }
    } else if (m.recordType === "contact") {
      const contact = await dbStore.contacts.findOne(m.recordId);
      if (contact) {
        name = `${contact.firstName} ${contact.lastName}`.trim() || "Unknown";
        email = contact.email || "prospect@example.com";
      }
    }

    data.push({
      membershipId: m.id,
      recordType: m.recordType,
      recordId: m.recordId,
      recordName: name,
      email,
      status: m.status,
      engagementScore: m.engagementScore ?? 0,
    });
  }

  return c.json({ success: true, data });
});

analyticsApp.post("/members/:id/recalculate-score", tenantAuth, async (c) => {
  const membershipId = c.req.param("id");
  const membership =
    await dbStore.marketingSequenceMemberships.findOne(membershipId);
  if (!membership) {
    return c.json({ success: false, error: "Membership not found" }, 404);
  }

  const score = await recalculateMemberEngagementScore(membershipId);
  return c.json({
    success: true,
    message: "Engagement score recalculated successfully",
    engagementScore: score,
  });
});

analyticsApp.get("/settings/variables", tenantAuth, async (c) => {
  const variables = await dbStore.marketingSequenceGlobalVariables.findMany();
  return c.json({ success: true, data: variables });
});

analyticsApp.post("/settings/variables", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { key, value } = body;

  if (!key || typeof key !== "string" || !/^[A-Za-z0-9_]+$/.test(key)) {
    return c.json(
      {
        success: false,
        error:
          "key is required and must contain only alphanumeric characters and underscores",
      },
      400,
    );
  }

  if (value === undefined || typeof value !== "string") {
    return c.json(
      {
        success: false,
        error: "value is required and must be a string",
      },
      400,
    );
  }

  const variable = await dbStore.marketingSequenceGlobalVariables.insert({
    orgId: tenant.orgId,
    key,
    value,
  });

  return c.json({ success: true, data: variable }, 201);
});

analyticsApp.delete("/settings/variables/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const variable = await dbStore.marketingSequenceGlobalVariables.findOne(id);
  if (!variable) {
    return c.json({ success: false, error: "Global variable not found" }, 404);
  }

  const deleted = await dbStore.marketingSequenceGlobalVariables.delete(id);
  if (!deleted) {
    return c.json({ success: false, error: "Global variable not found" }, 404);
  }

  return c.json({
    success: true,
    message: "Global variable deleted successfully",
  });
});
