import { dbStore } from "@crm/db";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

export const dashboardApp = new OpenAPIHono<Env>();
dashboardApp.use(tenantAuth);

const getLeadAnalyticsRoute = createRoute({
  method: "get",
  path: "/analytics",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              leadCount: z.number(),
              conversionRate: z.number(),
              avgVelocityDays: z.number(),
              slaBreachCount: z.number(),
              byOwner: z.array(
                z.object({
                  ownerId: z.string(),
                  ownerName: z.string(),
                  leadCount: z.number(),
                }),
              ),
            }),
          }),
        },
      },
      description: "Retrieve dashboard lead analytics",
    },
  },
});

dashboardApp.openapi(getLeadAnalyticsRoute, async (c) => {
  const tenant = c.get("tenant");

  // 1. Fetch leads
  const leads = await dbStore.leads.findMany();
  const leadCount = leads.length;

  // 2. Compute conversionRate
  const convertedCount = leads.filter((l) => l.status === "Converted").length;
  const conversionRate = leadCount > 0 ? (convertedCount / leadCount) * 100 : 0;

  // 3. Compute avgVelocityDays based on Audit Logs
  const auditLogs = await dbStore.auditLogs.findMany();
  const leadLogs = auditLogs.filter((log) => log.recordType === "Lead");

  let totalVelocityMs = 0;
  let convertedLeadCount = 0;

  const leadTimes: Record<string, { created?: Date; converted?: Date }> = {};
  for (const log of leadLogs) {
    if (!leadTimes[log.recordId]) {
      leadTimes[log.recordId] = {};
    }
    if (log.action === "create") {
      leadTimes[log.recordId].created = new Date(log.createdAt);
    } else if (log.action === "update") {
      const changes = log.changes as any;
      if (changes?.status?.after === "Converted") {
        leadTimes[log.recordId].converted = new Date(log.createdAt);
      }
    }
  }

  for (const leadId of Object.keys(leadTimes)) {
    const times = leadTimes[leadId];
    if (times.created && times.converted) {
      const diffMs = times.converted.getTime() - times.created.getTime();
      totalVelocityMs += diffMs;
      convertedLeadCount++;
    }
  }

  const avgVelocityDays =
    convertedLeadCount > 0
      ? totalVelocityMs / (1000 * 60 * 60 * 24 * convertedLeadCount)
      : 0;

  // 4. Compute slaBreachCount
  const slaTrackers = await dbStore.leadSlaTrackers.findMany();
  const slaBreachCount = slaTrackers.filter(
    (t) => t.status === "Breached",
  ).length;

  // 5. Group byOwner
  const ownerCounts: Record<string, number> = {};
  for (const lead of leads) {
    const ownerId = lead.ownerId;
    ownerCounts[ownerId] = (ownerCounts[ownerId] || 0) + 1;
  }

  const byOwner = [];
  for (const ownerId of Object.keys(ownerCounts)) {
    const user = await dbStore.users.findOne(ownerId);
    byOwner.push({
      ownerId,
      ownerName: user?.email || ownerId,
      leadCount: ownerCounts[ownerId],
    });
  }

  return c.json({
    success: true,
    data: {
      leadCount,
      conversionRate,
      avgVelocityDays,
      slaBreachCount,
      byOwner,
    },
  });
});
