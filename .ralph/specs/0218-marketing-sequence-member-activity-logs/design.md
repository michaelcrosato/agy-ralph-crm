# Specification: Marketing Sequence Member Activity Logs & Timeline API - Design

## 1. Core Logic & DB Mutators (`packages/core/src/index.ts`)

We will introduce a new core function `getMarketingSequenceMemberLogs` that performs the aggregation and RLS enforcement.

```typescript
export interface ActivityLogEntry {
  id: string;
  type: "sent" | "open" | "click" | "reply" | "bounce" | "complaint" | "read_time";
  timestamp: Date;
  details: Record<string, any>;
}

export async function getMarketingSequenceMemberLogs(
  dbStore: any,
  sequenceId: string,
  memberId: string,
  orgId: string
): Promise<ActivityLogEntry[]> {
  // 1. Fetch sequence and verify tenant context
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    throw new Error("Sequence not found");
  }
  if (seq.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  // 2. Fetch membership and verify sequence + tenant match
  const member = await dbStore.marketingSequenceMemberships.findOne(memberId);
  if (!member) {
    throw new Error("Membership not found");
  }
  if (member.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (member.sequenceId !== sequenceId) {
    throw new Error("Membership does not belong to this sequence");
  }

  // 3. Find all email trackers where activityId is the membership ID (or matches this recipient/member)
  const trackers = await dbStore.emailTrackers.findMany();
  const memberTrackers = trackers.filter(
    (t: any) => t.orgId === orgId && t.activityId === memberId
  );
  
  if (memberTrackers.length === 0) {
    return [];
  }

  const trackerIds = memberTrackers.map((t: any) => t.id);

  // 4. Fetch all related events
  const [opens, clicks, replies, bounces, readTimes] = await Promise.all([
    dbStore.emailOpenEvents.findMany().then((list: any[]) => list.filter(e => e.orgId === orgId && trackerIds.includes(e.trackerId))),
    dbStore.emailClickEvents.findMany().then((list: any[]) => list.filter(e => e.orgId === orgId && trackerIds.includes(e.trackerId))),
    dbStore.emailReplyEvents.findMany().then((list: any[]) => list.filter(e => e.orgId === orgId && trackerIds.includes(e.trackerId))),
    dbStore.emailBounceEvents.findMany().then((list: any[]) => list.filter(e => e.orgId === orgId && trackerIds.includes(e.trackerId))),
    dbStore.emailReadTimeEvents.findMany().then((list: any[]) => list.filter(e => e.orgId === orgId && trackerIds.includes(e.trackerId))),
  ]);

  const timeline: ActivityLogEntry[] = [];

  // Add Sent events for each tracker (the tracker itself represents a sent email)
  for (const tracker of memberTrackers) {
    timeline.push({
      id: tracker.id,
      type: "sent",
      timestamp: tracker.createdAt,
      details: {
        token: tracker.token,
        subject: tracker.subject || "",
      },
    });
  }

  // Add Open events
  for (const open of opens) {
    timeline.push({
      id: open.id,
      type: "open",
      timestamp: open.createdAt,
      details: {
        ipAddress: open.ipAddress,
        userAgent: open.userAgent,
        deviceType: open.deviceType,
      },
    });
  }

  // Add Click events
  for (const click of clicks) {
    timeline.push({
      id: click.id,
      type: "click",
      timestamp: click.createdAt,
      details: {
        clickedUrl: click.clickedUrl,
        ipAddress: click.ipAddress,
        userAgent: click.userAgent,
        utmSource: click.utmSource,
        utmMedium: click.utmMedium,
        utmCampaign: click.utmCampaign,
      },
    });
  }

  // Add Reply events
  for (const reply of replies) {
    timeline.push({
      id: reply.id,
      type: "reply",
      timestamp: reply.createdAt,
      details: {
        replyBody: reply.replyBody,
        senderEmail: reply.senderEmail,
        sentiment: reply.sentiment,
      },
    });
  }

  // Add Bounce events
  for (const bounce of bounces) {
    timeline.push({
      id: bounce.id,
      type: bounce.eventType === "complaint" ? "complaint" : "bounce",
      timestamp: bounce.createdAt,
      details: {
        bounceType: bounce.bounceType,
        bounceReason: bounce.bounceReason,
      },
    });
  }

  // Add Read Time events
  for (const rt of readTimes) {
    timeline.push({
      id: rt.id,
      type: "read_time",
      timestamp: rt.createdAt,
      details: {
        durationMs: rt.durationMs,
        readClassification: rt.readClassification,
      },
    });
  }

  // Sort timeline chronologically (newest first)
  return timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
```

## 2. API Endpoint Routing (`apps/api/src/index.ts`)

We will expose the endpoint:

```typescript
app.get("/api/sequences/:id/members/:memberId/logs", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const tenant = c.get("tenant");

  try {
    const logs = await getMarketingSequenceMemberLogs(
      dbStore,
      sequenceId,
      memberId,
      tenant.orgId
    );
    return c.json({ success: true, data: logs });
  } catch (err: any) {
    if (err.message.includes("RLS Isolation Violation")) {
      return c.json({ success: false, error: err.message }, 403);
    }
    if (err.message.includes("not found")) {
      return c.json({ success: false, error: err.message }, 404);
    }
    if (err.message.includes("does not belong")) {
      return c.json({ success: false, error: err.message }, 400);
    }
    return c.json({ success: false, error: err.message }, 500);
  }
});
```
