import { calculateUnsubscribeAnalytics } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

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
