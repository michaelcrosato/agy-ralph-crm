import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

export const dashboardApp = new Hono<Env>();

dashboardApp.get("/analytics", tenantAuth, async (c) => {
  const tenant = c.get("tenant");

  // RLS-isolated queries
  const allLeads = (await dbStore.leads.findMany()).filter(
    (l) => l.orgId === tenant.orgId,
  );

  const allTrackers = (await dbStore.leadSlaTrackers.findMany()).filter(
    (t) => t.orgId === tenant.orgId,
  );

  // 1. Leads counts matching status grouped by organization
  const statusCounts: Record<string, number> = {};
  for (const lead of allLeads) {
    statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
  }

  // 2. Conversion rate
  const convertedLeads = allLeads.filter(
    (l) => l.convertedAccountId || l.convertedContactId,
  );
  const conversionRate =
    allLeads.length > 0 ? convertedLeads.length / allLeads.length : 0;

  // 3. Conversion velocity (average response time of responded SLA trackers)
  const respondedTrackers = allTrackers.filter(
    (t) => t.respondedAt && t.responseTimeMinutes !== null,
  );
  const totalResponseTime = respondedTrackers.reduce(
    (sum, t) => sum + (t.responseTimeMinutes || 0),
    0,
  );
  const conversionVelocity =
    respondedTrackers.length > 0
      ? totalResponseTime / respondedTrackers.length
      : 0;

  // 4. Count of fuzzed/typo entries
  const fuzzedCount = allLeads.filter(
    (l) => !l.email?.includes("@") || !l.company,
  ).length;

  // 5. SLA statuses
  const slaStatuses = { Pending: 0, Met: 0, Breached: 0 };
  for (const t of allTrackers) {
    if (
      t.status === "Pending" ||
      t.status === "Met" ||
      t.status === "Breached"
    ) {
      slaStatuses[t.status]++;
    }
  }

  return c.json({
    success: true,
    data: {
      totalLeads: allLeads.length,
      statusCounts,
      conversionRate,
      conversionVelocity,
      fuzzedCount,
      slaStatuses,
    },
  });
});
