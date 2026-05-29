# Specification: Marketing Sequence Unsubscribe Analytics - Design

## 1. Core Domain Function
Add the following pure function to `packages/core/src/index.ts`:

```typescript
export interface UnsubscribeAnalyticsInput {
  unsubscribes: { id: string; reason: string; trackerId: string; orgId: string }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  links: { activityId: string; targetId: string; orgId: string }[];
  memberships: { sequenceId: string; recordId: string; status: string; orgId: string }[];
  sequences: { id: string; name: string; orgId: string }[];
}

export interface UnsubscribeAnalyticsResult {
  totalUnsubscribes: number;
  reasonBreakdown: { reason: string; count: number; percentage: string }[];
  sequenceBreakdown: { sequenceId: string; sequenceName: string; count: number; percentage: string }[];
}

export function calculateUnsubscribeAnalytics(params: UnsubscribeAnalyticsInput): UnsubscribeAnalyticsResult {
  // Implementation details for aggregation logic ...
}
```

## 2. REST Endpoints & Controller Logic
Update `apps/api/src/index.ts` to add the `GET /api/unsubscribes/analytics` endpoint:
1. Enforce `tenantAuth` middleware to secure the route.
2. Query `emailUnsubscribes`, `emailTrackers`, `activityLinks`, `marketingSequenceMemberships`, and `marketingSequences` tables under the tenant context.
3. Pass the fetched lists to `calculateUnsubscribeAnalytics`.
4. Return the aggregated data in the exact contract format.
