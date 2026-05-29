# Specification: Marketing Sequence Email Open Analytics - Design

## 1. Database Schema
Add `emailOpenEvents` table inside `packages/db/src/schema.ts` and update `packages/db/src/index.ts` to support in-memory store access and active tenant RLS isolation:
```typescript
export const emailOpenEvents = pgTable("email_open_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  deviceType: text("device_type").notNull().default("desktop"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

## 2. Core Domain Functions
Add the following interfaces and function to `packages/core/src/index.ts`:
```typescript
export interface OpenAnalyticsInput {
  opens: { id: string; trackerId: string; deviceType: string; orgId: string }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: { id: string; orgId: string; activityLinks: { targetType: string; targetId: string }[] }[]; // Mapped activity logs
  activitySteps: { activityId: string; stepId: string; orgId: string }[]; // Mapping of activity to sequence step
  steps: { id: string; name: string; orgId: string }[];
}

export interface DevicePerformanceMetric {
  deviceType: string;
  openCount: number;
  percentage: string;
}

export interface StepOpenRateMetric {
  stepId: string;
  stepName: string;
  totalSent: number;
  uniqueOpens: number;
  openRate: string;
}

export interface OpenAnalyticsResult {
  totalUniqueOpens: number;
  totalTrackedOpens: number;
  devicePerformance: DevicePerformanceMetric[];
  stepOpenRates: StepOpenRateMetric[];
}

export function calculateOpenAnalytics(params: OpenAnalyticsInput): OpenAnalyticsResult {
  // Implementation details for aggregation logic ...
}
```

## 3. REST Endpoints & Controller Logic
Update `apps/api/src/index.ts` to add two REST endpoints:
1. `POST /api/emails/track-open/:token`:
   - Public route (no tenantAuth).
   - Find matching `emailTrackers` record by token.
   - Parse device type from `userAgent`.
   - Update `openCount` and `lastOpenedAt` on tracker.
   - Insert new record into `emailOpenEvents`.
2. `GET /api/sequences/:id/opens-analytics`:
   - Secure route with `tenantAuth`.
   - Verify the sequence belongs to the active tenant.
   - Query `emailOpenEvents`, `emailTrackers`, `activities` (filtered by active tenant and having sequence step information), and `marketingSequenceSteps`.
   - Call `calculateOpenAnalytics` and return the result.
