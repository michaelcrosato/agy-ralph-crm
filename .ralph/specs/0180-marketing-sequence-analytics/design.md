# Specification: Marketing Sequence Step Performance Analytics API - Design

## 1. Core Logic Integration (`packages/core/src/index.ts`)

We will update `executePendingSequenceSteps` to create an `email_trackers` record:
```typescript
const trackerToken = `seq-track-${Math.random().toString(36).substring(2, 15)}`;
const tracker = await dbStore.emailTrackers.insert({
  orgId,
  activityId: activity.id,
  token: trackerToken,
});
```

We will implement a pure core function to compile sequence performance statistics:
```typescript
export interface StepAnalytics {
  stepNumber: number;
  templateId: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  openRate: string;
  clickRate: string;
}

export interface SequenceAnalyticsResult {
  sequenceId: string;
  totalEnrolled: number;
  statusCounts: {
    active: number;
    completed: number;
    unsubscribed: number;
    error: number;
  };
  overallOpenRate: string;
  overallClickRate: string;
  steps: StepAnalytics[];
}

export function calculateSequenceAnalytics(params: {
  sequenceId: string;
  steps: { id: string; stepNumber: number; templateId: string }[];
  memberships: { status: string; currentStepNumber: number; recordId: string; recordType: string }[];
  activities: { id: string; type: string }[];
  activityLinks: { activityId: string; targetId: string; targetType: string }[];
  emailTrackers: { activityId: string; openCount: number; clickCount: number }[];
}): SequenceAnalyticsResult;
```

## 2. API Route Configuration (`apps/api/src/index.ts`)

- **GET `/api/sequences/:id/analytics`**: Computes sequence aggregates.
  1. Retrieve the sequence and verify tenancy context.
  2. Fetch sequence steps, memberships, activities, links, and email trackers.
  3. Invoke `calculateSequenceAnalytics` and return the result.
