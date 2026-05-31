import { calculateSalesLeaderboard } from "@crm/core";
import { dbStore, store } from "@crm/db";
import { Hono } from "hono";
import { resourceRbac } from "../../middleware/rbac";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const leaderboardsApp = new Hono<Env>();

leaderboardsApp.use("*", tenantAuth, resourceRbac);

leaderboardsApp.get("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const periodParam = c.req.query("period");

  let period = periodParam;
  if (!period) {
    const today = new Date();
    period = today.toISOString().substring(0, 7);
  }

  const tenantMemberships = store.memberships.filter(
    (m) => m.orgId === tenant.orgId,
  );
  const usersInput = tenantMemberships.map((m) => {
    const u = store.users.find((user) => user.id === m.userId);
    return {
      userId: m.userId,
      userName: u ? u.email.split("@")[0] : "Unknown Rep",
    };
  });

  const opportunities = await dbStore.opportunities.findMany();
  const quotas = await dbStore.quotas.findMany();

  const oppsInput = opportunities.map((opp) => ({
    id: opp.id,
    ownerId: opp.ownerId,
    stage: opp.stage,
    amount: opp.amount,
    closeDate: opp.closeDate ? new Date(opp.closeDate) : null,
  }));

  const quotasInput = quotas.map((q) => ({
    userId: q.userId,
    period: q.period,
    targetAmount: q.targetAmount,
  }));

  const result = calculateSalesLeaderboard({
    period,
    users: usersInput,
    opportunities: oppsInput,
    quotas: quotasInput,
  });

  return c.json({
    success: true,
    ...result,
  });
});
