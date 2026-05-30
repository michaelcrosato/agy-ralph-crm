import {
  calculateCampaignRevenueShare,
  calculateOpportunityCommission,
  calculateOpportunitySplits,
  setPrimaryOpportunityContactRole,
  validateInfluencePercentageTotal,
  validateOpportunityTeamMember,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const opportunitiesTeamsApp = new Hono<Env>();

// ── Opportunity Splits ─────────────────────────────────────────────

opportunitiesTeamsApp.get("/:id/splits", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const splits = await dbStore.opportunitySplits.findForOpportunity(id);
  return c.json({ success: true, data: splits });
});

opportunitiesTeamsApp.post("/:id/splits", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const body = await c.req.json();
  const splitsInput = body.splits;
  if (!Array.isArray(splitsInput) || splitsInput.length === 0) {
    return c.json({ error: "splits must be a non-empty array" }, 400);
  }

  let calculatedSplits: ReturnType<typeof calculateOpportunitySplits>;
  try {
    calculatedSplits = calculateOpportunitySplits(
      opportunity.amount || "0",
      splitsInput,
    );
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      400,
    );
  }

  // Delete existing splits for this opportunity
  await dbStore.opportunitySplits.deleteManyForOpportunity(id);

  const insertedSplits = [];
  for (const s of calculatedSplits) {
    const ins = await dbStore.opportunitySplits.insert({
      orgId: tenant.orgId,
      opportunityId: id,
      userId: s.userId,
      percentage: s.percentage,
      splitAmount: s.splitAmount,
    });
    insertedSplits.push(ins);
  }

  // Update commissions!
  // Delete existing commissions for this opportunity
  await dbStore.commissions.deleteManyForOpportunity(id);

  // If the opportunity is Closed Won, calculate and insert new split commissions
  if (opportunity.stage === "Closed Won") {
    const quotas = await dbStore.quotas.findMany();
    const allCommissions = await dbStore.commissions.findMany();

    for (const split of insertedSplits) {
      const userQuota = quotas.find((q) => q.userId === split.userId);
      const userComms = allCommissions.filter(
        (comm) => comm.userId === split.userId,
      );
      const userTotalClosedWon = userComms.reduce(
        (sum, comm) => sum + (Number.parseFloat(comm.amount) || 0),
        0,
      );

      const commResult = calculateOpportunityCommission({
        opportunityAmount: split.splitAmount,
        opportunityStage: "Closed Won",
        quotaTarget: userQuota ? userQuota.targetAmount : null,
        currentClosedWonTotal: String(userTotalClosedWon),
      });

      await dbStore.commissions.insert({
        orgId: tenant.orgId,
        userId: split.userId,
        opportunityId: id,
        amount: commResult.commissionAmount,
        rateApplied: commResult.rateApplied,
        status: "Pending",
      });
    }
  }

  // Audit Log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "update_splits",
    userId: tenant.userId,
    changes: {
      splits: { before: null, after: splitsInput },
    },
  });

  return c.json({ success: true, data: insertedSplits });
});

opportunitiesTeamsApp.delete("/:id/splits", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  // Delete all splits for this opportunity
  await dbStore.opportunitySplits.deleteManyForOpportunity(id);

  // Revert commissions back to 100% to owner if Closed Won
  await dbStore.commissions.deleteManyForOpportunity(id);

  if (opportunity.stage === "Closed Won") {
    const quotas = await dbStore.quotas.findMany();
    const allCommissions = await dbStore.commissions.findMany();

    const ownerQuota = quotas.find((q) => q.userId === opportunity.ownerId);
    const ownerComms = allCommissions.filter(
      (comm) => comm.userId === opportunity.ownerId,
    );
    const ownerTotalClosedWon = ownerComms.reduce(
      (sum, comm) => sum + (Number.parseFloat(comm.amount) || 0),
      0,
    );

    const commResult = calculateOpportunityCommission({
      opportunityAmount: opportunity.amount || "0",
      opportunityStage: "Closed Won",
      quotaTarget: ownerQuota ? ownerQuota.targetAmount : null,
      currentClosedWonTotal: String(ownerTotalClosedWon),
    });

    await dbStore.commissions.insert({
      orgId: tenant.orgId,
      userId: opportunity.ownerId,
      opportunityId: id,
      amount: commResult.commissionAmount,
      rateApplied: commResult.rateApplied,
      status: "Pending",
    });
  }

  // Audit Log
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "delete_splits",
    userId: tenant.userId,
    changes: {
      splits: { before: "exists", after: null },
    },
  });

  return c.json({ success: true });
});

// ── Opportunity Contact Roles ──────────────────────────────────────

opportunitiesTeamsApp.get("/:id/contact-roles", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const roles = await dbStore.opportunityContactRoles.findForOpportunity(id);
  return c.json({ success: true, data: roles });
});

opportunitiesTeamsApp.post("/:id/contact-roles", tenantAuth, async (c) => {
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

opportunitiesTeamsApp.put(
  "/:id/contact-roles/:roleId",
  tenantAuth,
  async (c) => {
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
  },
);

opportunitiesTeamsApp.delete(
  "/:id/contact-roles/:roleId",
  tenantAuth,
  async (c) => {
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
  },
);

// ── Campaign Influence ─────────────────────────────────────────────

opportunitiesTeamsApp.get("/:id/campaign-influence", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opp = await dbStore.opportunities.findOne(id);
  if (!opp) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const influences = await dbStore.campaignInfluence.findForOpportunity(id);
  return c.json({ success: true, data: influences });
});

opportunitiesTeamsApp.post("/:id/campaign-influence", tenantAuth, async (c) => {
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

opportunitiesTeamsApp.delete(
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

// ── Competitors ────────────────────────────────────────────────────

opportunitiesTeamsApp.get("/:id/competitors", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  if (opportunity.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const allCompetitors = await dbStore.opportunityCompetitors.findMany();
  const competitors = allCompetitors.filter(
    (comp) => comp.opportunityId === id,
  );

  return c.json({ success: true, data: competitors });
});

opportunitiesTeamsApp.post("/:id/competitors", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  if (opportunity.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  if (!body.name || body.name.trim() === "") {
    return c.json({ error: "Competitor name is required." }, 400);
  }

  const winLossStatus = body.winLossStatus || "Pending";
  if (!["Pending", "Won", "Lost"].includes(winLossStatus)) {
    return c.json({ error: "Invalid winLossStatus." }, 400);
  }

  const newCompetitor = await dbStore.opportunityCompetitors.insert({
    orgId: tenant.orgId,
    opportunityId: id,
    name: body.name.trim(),
    strength: body.strength || null,
    weakness: body.weakness || null,
    winLossStatus,
    notes: body.notes || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newCompetitor.id,
    recordType: "opportunity_competitors",
    action: "create",
    userId: tenant.userId,
    changes: { competitor: { before: null, after: newCompetitor } },
  });

  await triggerOutboundWebhooks(tenant.orgId, "competitor.created", {
    competitor: newCompetitor,
  });

  return c.json({ success: true, data: newCompetitor }, 201);
});

opportunitiesTeamsApp.put(
  "/:id/competitors/:competitorId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const competitorId = c.req.param("competitorId");
    const body = await c.req.json().catch(() => ({}));

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    if (opportunity.orgId !== tenant.orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }

    const competitor =
      await dbStore.opportunityCompetitors.findOne(competitorId);
    if (!competitor || competitor.opportunityId !== id) {
      return c.json({ error: "Competitor not found on this opportunity" }, 404);
    }

    if (
      body.winLossStatus &&
      !["Pending", "Won", "Lost"].includes(body.winLossStatus)
    ) {
      return c.json({ error: "Invalid winLossStatus." }, 400);
    }

    const updates: Partial<
      Omit<
        Parameters<typeof dbStore.opportunityCompetitors.update>[1],
        "id" | "orgId" | "createdAt"
      >
    > = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.strength !== undefined) updates.strength = body.strength;
    if (body.weakness !== undefined) updates.weakness = body.weakness;
    if (body.winLossStatus !== undefined)
      updates.winLossStatus = body.winLossStatus;
    if (body.notes !== undefined) updates.notes = body.notes;

    const updatedCompetitor = await dbStore.opportunityCompetitors.update(
      competitorId,
      updates,
    );

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: competitorId,
      recordType: "opportunity_competitors",
      action: "update",
      userId: tenant.userId,
      changes: { competitor: { before: competitor, after: updatedCompetitor } },
    });

    await triggerOutboundWebhooks(tenant.orgId, "competitor.updated", {
      competitor: updatedCompetitor,
    });

    return c.json({ success: true, data: updatedCompetitor });
  },
);

opportunitiesTeamsApp.delete(
  "/:id/competitors/:competitorId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const competitorId = c.req.param("competitorId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    if (opportunity.orgId !== tenant.orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }

    const competitor =
      await dbStore.opportunityCompetitors.findOne(competitorId);
    if (!competitor || competitor.opportunityId !== id) {
      return c.json({ error: "Competitor not found on this opportunity" }, 404);
    }

    const deleted = await dbStore.opportunityCompetitors.delete(competitorId);

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: competitorId,
      recordType: "opportunity_competitors",
      action: "delete",
      userId: tenant.userId,
      changes: { competitor: { before: competitor, after: null } },
    });

    await triggerOutboundWebhooks(tenant.orgId, "competitor.deleted", {
      competitorId,
    });

    return c.json({ success: deleted });
  },
);

// ── Opportunity Teams ──────────────────────────────────────────────

opportunitiesTeamsApp.get("/:id/team", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const team = await dbStore.opportunityTeams.findForOpportunity(id);
  return c.json({ success: true, data: team });
});

opportunitiesTeamsApp.post("/:id/team", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const userId = body.userId;
  const role = body.role;

  const validation = validateOpportunityTeamMember(id, userId, role);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const team = await dbStore.opportunityTeams.findForOpportunity(id);
  const priorMember = team.find((t) => t.userId === userId);
  const action = priorMember
    ? "opportunity_team_member_updated"
    : "opportunity_team_member_added";

  const updatedMember = await dbStore.opportunityTeams.addOrUpdateMember(
    id,
    userId,
    role,
  );

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action,
    userId: tenant.userId,
    changes: {
      teamMember: { before: priorMember || null, after: updatedMember },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "opportunity.team_updated", {
    opportunityId: id,
    userId,
    role,
    action,
  });

  return c.json(
    { success: true, data: updatedMember },
    priorMember ? 200 : 201,
  );
});

opportunitiesTeamsApp.delete("/:id/team/:userId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const userId = c.req.param("userId");

  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const team = await dbStore.opportunityTeams.findForOpportunity(id);
  const priorMember = team.find((t) => t.userId === userId);
  if (!priorMember) {
    return c.json({ error: "Team member not found on this opportunity" }, 404);
  }

  await dbStore.opportunityTeams.removeMember(id, userId);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "opportunities",
    action: "opportunity_team_member_removed",
    userId: tenant.userId,
    changes: {
      teamMember: { before: priorMember, after: null },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "opportunity.team_updated", {
    opportunityId: id,
    userId,
    action: "opportunity_team_member_removed",
  });

  return c.json({ success: true });
});
