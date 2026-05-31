import { validateOpportunityTeamMember } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../../lib/webhooks";
import { type Env, tenantAuth } from "../../../middleware/tenantAuth";

export const teamMembersApp = new Hono<Env>();

teamMembersApp.get("/:id/team", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }
  const team = await dbStore.opportunityTeams.findForOpportunity(id);
  return c.json({ success: true, data: team });
});

teamMembersApp.post("/:id/team", tenantAuth, async (c) => {
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

teamMembersApp.delete("/:id/team/:userId", tenantAuth, async (c) => {
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
