import {
  calculateRecipientEngagementScore,
  processSequenceMembershipScoreTriggers,
} from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";

export async function recalculateMemberEngagementScore(
  membershipId: string,
): Promise<number> {
  const membership =
    await dbStore.marketingSequenceMemberships.findOne(membershipId);
  if (!membership) return 0;

  const allLinks = await dbStore.activityLinks.findMany();
  const memberLinks = allLinks.filter(
    (l) =>
      l.targetId === membership.recordId &&
      l.targetType.toLowerCase() === membership.recordType.toLowerCase(),
  );

  const activityIds = memberLinks.map((l) => l.activityId);

  const allTrackers = await dbStore.emailTrackers.findMany();
  const memberTrackers = allTrackers.filter(
    (t) => t.activityId && activityIds.includes(t.activityId),
  );

  const trackerIds = memberTrackers.map((t) => t.id);

  const allReadTimeEvents = await dbStore.emailReadTimeEvents.findMany();
  const memberReadTimeEvents = allReadTimeEvents.filter((e) =>
    trackerIds.includes(e.trackerId),
  );

  const allBounceEvents = await dbStore.emailBounceEvents.findMany();
  const memberBounceEvents = allBounceEvents.filter((e) =>
    trackerIds.includes(e.trackerId),
  );

  let openCount = 0;
  let clickCount = 0;
  let replyCount = 0;
  for (const t of memberTrackers) {
    openCount += t.openCount;
    clickCount += t.clickCount;
    replyCount += t.replyCount;
  }

  const isUnsubscribed = membership.status === "unsubscribed";

  const score = calculateRecipientEngagementScore({
    openCount,
    clickCount,
    replyCount,
    readTimeEvents: memberReadTimeEvents.map((e) => ({
      durationMs: e.durationMs,
      readClassification: e.readClassification,
    })),
    bounceEvents: memberBounceEvents.map((e) => ({
      eventType: e.eventType,
      bounceType: e.bounceType,
    })),
    isUnsubscribed,
  });

  await dbStore.marketingSequenceMemberships.update(membershipId, {
    engagementScore: score,
  });

  await processSequenceMembershipScoreTriggers(
    dbStore,
    membership.orgId,
    membershipId,
  );

  return score;
}

export async function recalculateEngagementScoreByTrackerToken(
  token: string,
): Promise<void> {
  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (!tracker) return;

  const allLinks = await dbStore.activityLinks.findMany();
  const link = allLinks.find((l) => l.activityId === tracker.activityId);
  if (!link) return;

  const allMemberships = await dbStore.marketingSequenceMemberships.findMany();
  const membership = allMemberships.find(
    (m) =>
      m.recordId === link.targetId &&
      m.recordType.toLowerCase() === link.targetType.toLowerCase(),
  );

  if (membership) {
    await withTenant(membership.orgId, mockDb, async () => {
      await recalculateMemberEngagementScore(membership.id);
    });
  }
}
