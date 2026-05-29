# Specification: Marketing Sequence Email Granular Bounce & Spam Complaint Events & Bounce Analytics - Design

## 1. Database Schema
Add `emailBounceEvents` table inside `packages/db/src/schema.ts` and update `packages/db/src/index.ts` to support in-memory store access and active tenant RLS isolation:
```typescript
export const emailBounceEvents = pgTable("email_bounce_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'bounce' | 'complaint'
  bounceType: text("bounce_type").notNull().default("hard"), // 'hard' | 'soft' | 'spam_complaint'
  bounceReason: text("bounce_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Update `packages/db/src/schema.ts` to add the fields to the `emailTrackers` table:
```typescript
bounceCount: integer("bounce_count").notNull().default(0),
lastBouncedAt: timestamp("last_bounced_at"),
```

Update `packages/db/src/index.ts` to add `DBEmailBounceEvent` interface and wire up the `emailBounceEvents` store operations using the tenant context filters. Also update `DBEmailTracker` interface and store methods to support the new tracking columns.

## 2. Core Domain Functions
Add the following interfaces and function to `packages/core/src/index.ts`:
```typescript
export interface BounceAnalyticsInput {
  bounces: { id: string; trackerId: string; eventType: string; bounceType: string; orgId: string }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: { id: string; orgId: string }[];
  activityLinks: { activityId: string; targetId: string; targetType: string; orgId: string }[];
  memberships: { id: string; sequenceId: string; recordId: string; recordType: string; orgId: string }[];
  steps: { id: string; name: string; stepNumber: number; orgId: string }[];
  sequenceId: string;
}

export interface BounceTypePerformanceMetric {
  bounceType: string;
  eventCount: number;
  percentage: string;
}

export interface StepBounceRateMetric {
  stepId: string;
  stepName: string;
  totalSent: number;
  uniqueBounces: number;
  bounceRate: string;
}

export interface BounceAnalyticsResult {
  totalBounces: number;
  totalComplaints: number;
  totalUniqueBouncedTrackers: number;
  bounceRate: string;
  bounceTypePerformance: BounceTypePerformanceMetric[];
  stepBounceRates: StepBounceRateMetric[];
}

export function calculateBounceAnalytics(params: BounceAnalyticsInput): BounceAnalyticsResult {
  // Implementation details for aggregation logic ...
}
```

Update `handleEmailDeliveryEvent` in `packages/core/src/index.ts` to insert granular bounce/complaint events into `emailBounceEvents` store when delivery events occur.

## 3. REST Endpoints & Controller Logic
Update `apps/api/src/index.ts` to add two REST endpoints:
1. `POST /api/public/emails/track/bounce/:token`:
   - Public route.
   - Accept dynamic bounce details from the body (`eventType`, `bounceType`, `bounceReason`).
   - Find matching `emailTrackers` and update its public `bounceCount` and `lastBouncedAt`.
   - Call `handleEmailDeliveryEvent` to suspend memberships and create suppressions.
   - Log the event in `emailBounceEvents`.
2. `GET /api/sequences/:id/bounces-analytics`:
   - Secure route with `tenantAuth`.
   - Query `emailBounceEvents`, `emailTrackers`, `activities`, `activityLinks`, `marketingSequenceMemberships`, and `marketingSequenceSteps`.
   - Call `calculateBounceAnalytics` and return the result.
