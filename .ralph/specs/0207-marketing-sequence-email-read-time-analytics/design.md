# Specification: Marketing Sequence Email Read Time Analytics & Scoring - Design

## 1. Database Schema
Add `emailReadTimeEvents` table inside `packages/db/src/schema.ts` and update `packages/db/src/index.ts` to support in-memory store access and active tenant RLS isolation:
```typescript
export const emailReadTimeEvents = pgTable("email_read_time_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  durationMs: integer("duration_ms").notNull(),
  readClassification: text("read_classification").notNull(), // 'glanced' | 'skimmed' | 'read'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Update `packages/db/src/schema.ts` to add the fields to the `emailTrackers` table:
```typescript
totalReadTimeMs: integer("total_read_time_ms").notNull().default(0),
lastReadClassification: text("last_read_classification"),
```

Update `packages/db/src/index.ts` to add `DBEmailReadTimeEvent` interface and wire up the `emailReadTimeEvents` store operations using the tenant context filters. Also update `DBEmailTracker` interface and store methods to support the new tracking columns.

## 2. Core Domain Functions
Add the following interfaces and function to `packages/core/src/index.ts`:
```typescript
export interface ReadTimeAnalyticsInput {
  readTimeEvents: { id: string; trackerId: string; durationMs: number; readClassification: string; orgId: string }[];
  trackers: { id: string; activityId: string; openCount: number; orgId: string }[];
  activities: { id: string; orgId: string }[];
  activityLinks: { activityId: string; targetId: string; targetType: string; orgId: string }[];
  memberships: { id: string; sequenceId: string; recordId: string; recordType: string; orgId: string }[];
  steps: { id: string; name: string; stepNumber: number; orgId: string }[];
  sequenceId: string;
}

export interface ReadTimePerformanceMetric {
  classification: string;
  eventCount: number;
  percentage: string;
}

export interface StepReadTimeStatsMetric {
  stepId: string;
  stepName: string;
  openCount: number;
  glancedCount: number;
  skimmedCount: number;
  readCount: number;
}

export interface ReadTimeAnalyticsResult {
  totalGlanced: number;
  totalSkimmed: number;
  totalRead: number;
  averageReadTimeMs: number;
  readTimeClassificationPerformance: ReadTimePerformanceMetric[];
  stepReadTimeStats: StepReadTimeStatsMetric[];
}

export function calculateReadTimeAnalytics(params: ReadTimeAnalyticsInput): ReadTimeAnalyticsResult {
  // Implementation details for aggregation logic ...
}
```

## 3. REST Endpoints & Controller Logic
Update `apps/api/src/index.ts` to add two REST endpoints:
1. `POST /api/public/emails/track/read-time/:token`:
   - Public route.
   - Accept dynamic read time details from the body (`durationMs`).
   - Classify duration: `'glanced'` (< 2000), `'skimmed'` (2000 - 7999), `'read'` (>= 8000).
   - Find matching `emailTrackers` and update its public `totalReadTimeMs` and `lastReadClassification`.
   - Log the event in `emailReadTimeEvents`.
2. `GET /api/sequences/:id/read-time-analytics`:
   - Secure route with `tenantAuth`.
   - Query `emailReadTimeEvents`, `emailTrackers`, `activities`, `activityLinks`, `marketingSequenceMemberships`, and `marketingSequenceSteps`.
   - Call `calculateReadTimeAnalytics` and return the result.
