# Specification: Marketing Sequence Recipient Engagement Scoring - Design

## 1. Database Schema
Add `engagementScore` to the `marketingSequenceMemberships` table inside `packages/db/src/schema.ts`:
```typescript
export const marketingSequenceMemberships = pgTable(
  "marketing_sequence_memberships",
  {
    // ... other columns
    engagementScore: integer("engagement_score").notNull().default(0),
    // ... other columns
  }
);
```

Update `packages/db/src/index.ts` to include `engagementScore` in `DBMarketingSequenceMembership` and support it in standard store operations (`insert`, `update`).

## 2. Core Domain Functions
Add the following interfaces and function to `packages/core/src/index.ts`:

```typescript
export interface EngagementScoreEventsInput {
  openCount: number;
  clickCount: number;
  replyCount: number;
  readTimeEvents: { durationMs: number; readClassification: string }[];
  bounceEvents: { eventType: string; bounceType: string }[];
  isUnsubscribed: boolean;
}

export function calculateRecipientEngagementScore(events: EngagementScoreEventsInput): number {
  let score = 0;

  // 1. Opens (+1 per event)
  score += events.openCount * 1;

  // 2. Clicks (+3 per event)
  score += events.clickCount * 3;

  // 3. Replies (+10 per event)
  score += events.replyCount * 10;

  // 4. Read times
  for (const event of events.readTimeEvents) {
    if (event.readClassification === "skimmed") {
      score += 2;
    } else if (event.readClassification === "read") {
      score += 5;
    }
  }

  // 5. Bounces & Complaints
  for (const event of events.bounceEvents) {
    if (event.eventType === "complaint" || event.bounceType === "spam_complaint") {
      score -= 10;
    } else if (event.eventType === "bounce") {
      score -= 5;
    }
  }

  // 6. Unsubscribed penalty (-15 points)
  if (events.isUnsubscribed) {
    score -= 15;
  }

  return score;
}
```

## 3. REST Endpoints & Recalculation Integration
Update `apps/api/src/index.ts` to:
1. Provide a secure REST endpoint `GET /api/sequences/:id/engagement-scores` that fetches all memberships of a sequence and joins/queries associated Leads/Contacts names and emails, returning their computed/stored `engagementScore`.
2. Provide a secure REST endpoint `POST /api/sequences/members/:id/recalculate-score` that fetches the specific membership, aggregates all its events, computes the engagement score using `calculateRecipientEngagementScore`, updates it in the DB, and returns the result.
3. Integrate real-time recalculation inside the public tracking endpoints (opens, clicks, replies, bounces, read times, unsubscribes) so that whenever an event is logged:
   - Identify the associated lead/contact record.
   - Find if there's any active `marketingSequenceMemberships` for this record.
   - Aggregate all tracking events associated with this membership's activities.
   - Call `calculateRecipientEngagementScore` and update the membership's `engagementScore` in the store.
