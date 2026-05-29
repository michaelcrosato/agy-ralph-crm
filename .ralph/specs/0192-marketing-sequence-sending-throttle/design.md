# Specification: Marketing Sequence Daily Sending Throttle Limit - Design

## 1. Database Schema Upgrades

### 1.1 Drizzle Schema Definition (`packages/db/src/schema.ts`)
We will add `dailySendLimit` property to the `marketingSequences` table:
```typescript
export const marketingSequences = pgTable("marketing_sequences", {
  // ... other fields ...
  dailySendLimit: integer("daily_send_limit"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### 1.2 In-Memory Mock Store Updates (`packages/db/src/index.ts`)
Extend the `DBMarketingSequence` interface to support this field:
```typescript
export interface DBMarketingSequence {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: string; // "active" | "draft"
  sendingWindowStart?: string | null;
  sendingWindowEnd?: string | null;
  sendingDays?: number[] | null;
  allowReenrollment?: boolean | null;
  reenrollmentMinDays?: number | null;
  dailySendLimit?: number | null; // Added
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 2. Core Business Logic Upgrades

### 2.1 Core Types (`packages/core/src/index.ts`)
Extend the `CoreSequence` interface:
```typescript
export interface CoreSequence {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: string;
  sendingWindowStart?: string | null;
  sendingWindowEnd?: string | null;
  sendingDays?: number[] | null;
  allowReenrollment?: boolean | null;
  reenrollmentMinDays?: number | null;
  dailySendLimit?: number | null; // Added
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 `executePendingSequenceSteps` Updates
Update `executePendingSequenceSteps` loop in `packages/core/src/index.ts`.
Keep track of how many emails were sent today for each sequence:
```typescript
  // Keep track of executions today per sequence
  const sequenceSendsToday = new Map<string, number>();

  function isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  // Pre-populate execution counts from memberships successfully executed today
  for (const m of memberships) {
    if (m.lastExecutedAt && isSameDay(new Date(m.lastExecutedAt), currentTime)) {
      const count = sequenceSendsToday.get(m.sequenceId) || 0;
      sequenceSendsToday.set(m.sequenceId, count + 1);
    }
  }
```

Inside the eligible membership execution loop:
```typescript
    // Check if the daily send limit is reached for this sequence
    if (dbStore.marketingSequences) {
      const sequence = await dbStore.marketingSequences.findOne(membership.sequenceId);
      if (sequence && sequence.dailySendLimit !== undefined && sequence.dailySendLimit !== null && sequence.dailySendLimit > 0) {
        const sentCount = sequenceSendsToday.get(membership.sequenceId) || 0;
        if (sentCount >= sequence.dailySendLimit) {
          // Defer membership execution to the next day
          const validDeferredTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
          const originalNext = membership.nextExecutionAt;

          await dbStore.marketingSequenceMemberships.update(membership.id, {
            nextExecutionAt: validDeferredTime,
          });

          await dbStore.auditLogs.insert({
            orgId: membership.orgId,
            recordId: membership.id,
            recordType: "marketing_sequence_memberships",
            action: "membership_schedule_deferred",
            userId: "00000000-0000-0000-0000-000000000000",
            changes: {
              nextExecutionAt: {
                before: originalNext instanceof Date ? originalNext.toISOString() : new Date(originalNext).toISOString(),
                after: validDeferredTime.toISOString(),
              },
              throttle_reason: {
                before: null,
                after: `Daily sending throttle reached: limit is ${sequence.dailySendLimit}`,
              },
            },
          });
          continue;
        }
      }
    }
```

When execution completes successfully, increment the counter:
```typescript
    const count = sequenceSendsToday.get(membership.sequenceId) || 0;
    sequenceSendsToday.set(membership.sequenceId, count + 1);
```

---

## 3. REST Endpoint Changes (`apps/api/src/index.ts`)
- In `POST /api/sequences`:
  Read `dailySendLimit` and validate it as positive integer or null.
- In `POST /api/sequences/:id/schedule`:
  Read `dailySendLimit` and validate it as positive integer or null.
