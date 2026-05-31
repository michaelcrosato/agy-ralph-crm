import {
  calculateCampaignRevenueShare,
  validateInfluencePercentageTotal,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../../lib/webhooks";
import { type Env, tenantAuth } from "../../../middleware/tenantAuth";

export const campaignInfluenceApp = new Hono<Env>();

campaignInfluenceApp.get("/:id/campaign-influence", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opp = await dbStore.opportunities.findOne(id);
  if (!opp) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const influences = await dbStore.campaignInfluence.findForOpportunity(id);
  return c.json({ success: true, data: influences });
});

campaignInfluenceApp.post("/:id/campaign-influence", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const opp = await dbStore.opportunities.findOne(id);
  if (!opp) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { campaignId, influencePercentage } = body;

  if (!campaignId || influencePercentage === undefined) {
    return c.json(
      { error: "campaignId and influencePercentage are required" },
      400,
    );
  }

  const pct = Number.parseInt(influencePercentage, 10);
  if (Number.isNaN(pct) || pct < 0 || pct > 100) {
    return c.json(
      { error: "influencePercentage must be an integer between 0 and 100" },
      400,
    );
  }

  const existingInfluences =
    await dbStore.campaignInfluence.findForOpportunity(id);

  const alreadyLinked = existingInfluences.some(
    (i) => i.campaignId === campaignId,
  );
  if (alreadyLinked) {
    return c.json(
      { error: "Campaign already has an influence record on this opportunity" },
      400,
    );
  }

  const valid = validateInfluencePercentageTotal(existingInfluences, pct);
  if (!valid) {
    return c.json(
      { error: "Total campaign influence percentage cannot exceed 100%" },
      400,
    );
  }

  const amount = opp.amount || "0";
  const revenueShare = calculateCampaignRevenueShare(amount, pct);

  const newInfluence = await dbStore.campaignInfluence.insert({
    orgId: tenant.orgId,
    opportunityId: id,
    campaignId,
    influencePercentage: pct,
    revenueShare,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "add_campaign_influence",
    userId: tenant.userId,
    changes: {
      campaignInfluence: { before: null, after: newInfluence },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "opportunity.campaign_influence.created",
    newInfluence as unknown as Record<string, unknown>,
  );

  return c.json({ success: true, data: newInfluence }, 201);
});

campaignInfluenceApp.delete(
  "/:id/campaign-influence/:influenceId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const influenceId = c.req.param("influenceId");

    const opp = await dbStore.opportunities.findOne(id);
    if (!opp) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const currentInfluence =
      await dbStore.campaignInfluence.findOne(influenceId);
    if (!currentInfluence || currentInfluence.opportunityId !== id) {
      return c.json({ error: "Campaign influence record not found" }, 404);
    }

    await dbStore.campaignInfluence.delete(influenceId);

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "opportunities",
      action: "remove_campaign_influence",
      userId: tenant.userId,
      changes: {
        campaignInfluence: { before: currentInfluence, after: null },
      },
    });

    await triggerOutboundWebhooks(
      tenant.orgId,
      "opportunity.campaign_influence.deleted",
      {
        orgId: tenant.orgId,
        opportunityId: id,
        campaignId: currentInfluence.campaignId,
        id: influenceId,
      },
    );

    return c.json({ success: true });
  },
);
