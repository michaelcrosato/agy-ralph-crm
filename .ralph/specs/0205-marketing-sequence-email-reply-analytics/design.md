# Specification: Marketing Sequence Email Reply Analytics - Design

## 1. Database Schema
Add `emailReplyEvents` table inside `packages/db/src/schema.ts` and update `packages/db/src/index.ts` to support in-memory store access and active tenant RLS isolation:
```typescript
export const emailReplyEvents = pgTable("email_reply_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  replyBody: text("reply_body"),
  senderEmail: text("sender_email").notNull(),
  sentiment: text("sentiment").notNull().default("neutral"), // 'positive' | 'negative' | 'neutral'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Update `packages/db/src/index.ts` to add `DBEmailReplyEvent` interface and wire up the `emailReplyEvents` store operations using the tenant context filters.

## 2. Core Domain Functions
Add the following interfaces and function to `packages/core/src/index.ts`:
```typescript
export interface ReplyAnalyticsInput {
  replies: { id: string; trackerId: string; sentiment: string; orgId: string }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: { id: string; orgId: string }[];
  activityLinks: { activityId: string; targetId: string; targetType: string; orgId: string }[];
  memberships: { id: string; sequenceId: string; recordId: string; recordType: string; orgId: string }[];
  steps: { id: string; name: string; stepNumber: number; orgId: string }[];
  sequenceId: string;
}

export interface SentimentPerformanceMetric {
  sentiment: string;
  replyCount: number;
  percentage: string;
}

export interface StepReplyRateMetric {
  stepId: string;
  stepName: string;
  totalSent: number;
  uniqueReplies: number;
  replyRate: string;
}

export interface ReplyAnalyticsResult {
  totalUniqueReplies: number;
  totalTrackedReplies: number;
  replyRate: string;
  sentimentPerformance: SentimentPerformanceMetric[];
  stepReplyRates: StepReplyRateMetric[];
}

export function calculateReplyAnalytics(params: ReplyAnalyticsInput): ReplyAnalyticsResult {
  // Implementation details for aggregation logic ...
}
```

Update `processSequenceEmailReply` in `packages/core/src/index.ts` to insert the granular reply event and determine sentiment based on reply body keywords.

## 3. REST Endpoints & Controller Logic
Update `apps/api/src/index.ts` to add / update two REST endpoints:
1. `POST /api/public/emails/track/reply/:token`:
   - Public route.
   - Update body parsing to support optional `replyBody` and `senderEmail`.
   - Categorize sentiment from `replyBody`.
   - Log reply event in `emailReplyEvents`.
2. `GET /api/sequences/:id/replies-analytics`:
   - Secure route with `tenantAuth`.
   - Query `emailReplyEvents`, `emailTrackers`, `activities`, `activityLinks`, `marketingSequenceMemberships`, and `marketingSequenceSteps`.
   - Call `calculateReplyAnalytics` and return the result.
