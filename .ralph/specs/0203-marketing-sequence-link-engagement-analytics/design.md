# Specification: Marketing Sequence Link Engagement Analytics - Design

## 1. Core Domain Function
Add the following pure function to `packages/core/src/index.ts`:

```typescript
export interface LinkEngagementInput {
  clicks: { id: string; trackerId: string; clickedUrl: string; orgId: string }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activitySteps: { activityId: string; stepId: string; orgId: string }[]; // Mapping of email activity to sequence step
  steps: { id: string; name: string; orgId: string }[];
}

export interface LinkPerformanceMetric {
  clickedUrl: string;
  stepId: string;
  stepName: string;
  clickCount: number;
  percentage: string;
}

export interface LinkEngagementResult {
  totalTrackedClicks: number;
  linkPerformance: LinkPerformanceMetric[];
}

export function calculateLinkEngagementAnalytics(params: LinkEngagementInput): LinkEngagementResult {
  // Implementation details for aggregation logic ...
}
```

## 2. REST Endpoints & Controller Logic
Update `apps/api/src/index.ts` to add the `GET /api/sequences/:seqId/links-analytics` endpoint:
1. Enforce `tenantAuth` middleware to secure the route.
2. Verify the marketing sequence exists and belongs to the active tenant.
3. Query `emailClickEvents`, `emailTrackers`, `activities` (where sequence/step is populated), and `marketingSequenceSteps` tables under the tenant context.
4. Call `calculateLinkEngagementAnalytics` using the queried lists.
5. Return the aggregated link engagement metrics.
