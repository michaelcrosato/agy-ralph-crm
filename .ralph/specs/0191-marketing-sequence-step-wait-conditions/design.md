# Specification: Marketing Sequence Step Wait Conditions - Design

## 1. Database Schema Upgrades

### 1.1 Drizzle Schema Definition (`packages/db/src/schema.ts`)
We will add `waitCondition` jsonb property to the `marketingSequenceSteps` table:
```typescript
export const marketingSequenceSteps = pgTable("marketing_sequence_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => marketingSequences.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  delayDays: integer("delay_days").notNull().default(0),
  templateId: uuid("template_id")
    .notNull()
    .references(() => emailTemplates.id, { onDelete: "cascade" }),
  waitCondition: jsonb("wait_condition"), // { waitType: "day_of_week", daysOfWeek: number[], timeOfDay?: string }
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### 1.2 In-Memory Mock Store Updates (`packages/db/src/index.ts`)
Extend the `DBMarketingSequenceStep` interface to support this field:
```typescript
export interface DBMarketingSequenceStep {
  id: string;
  orgId: string;
  sequenceId: string;
  stepNumber: number;
  delayDays: number;
  templateId: string;
  waitCondition?: {
    waitType: "day_of_week" | "duration";
    daysOfWeek?: number[];
    timeOfDay?: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 2. Core Business Logic Upgrades

### 2.1 Core Types (`packages/core/src/index.ts`)
Extend the `CoreSequenceStep` interface:
```typescript
export interface CoreSequenceStep {
  id: string;
  orgId: string;
  sequenceId: string;
  stepNumber: number;
  delayDays: number;
  templateId: string;
  waitCondition?: {
    waitType: "day_of_week" | "duration";
    daysOfWeek?: number[];
    timeOfDay?: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Date Calculation Utility
We will implement `calculateNextStepExecutionTime` in `packages/core/src/index.ts` to solve wait conditions:
```typescript
export function calculateNextStepExecutionTime(
  currentTime: Date,
  delayDays: number,
  waitCondition?: CoreSequenceStep["waitCondition"],
): Date {
  // Start by applying delayDays
  let target = new Date(currentTime.getTime() + delayDays * 24 * 60 * 60 * 1000);

  if (!waitCondition || waitCondition.waitType !== "day_of_week") {
    return target;
  }

  const daysOfWeek = waitCondition.daysOfWeek || [];
  if (daysOfWeek.length === 0) {
    return target;
  }

  // Find next occurrence of one of the specified days of week
  let found = false;
  for (let i = 0; i < 7; i++) {
    const day = target.getDay();
    if (daysOfWeek.includes(day)) {
      found = true;
      break;
    }
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
  }

  // Parse timeOfDay if specified
  if (waitCondition.timeOfDay) {
    const parts = waitCondition.timeOfDay.split(":");
    if (parts.length === 2) {
      const hours = Number.parseInt(parts[0], 10);
      const minutes = Number.parseInt(parts[1], 10);
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        target.setHours(hours, minutes, 0, 0);
      }
    }
  }

  return target;
}
```

### 2.3 `executePendingSequenceSteps` Updates
Update where the next step's execution time is calculated in `packages/core/src/index.ts` (lines 5128-5136):
```typescript
      const nextStep = steps.find((s) => s.stepNumber === nextStepNumber + 1);
      if (!nextStep) {
        nextStatus = "completed";
      } else {
        nextExecTime = calculateNextStepExecutionTime(
          currentTime,
          nextStep.delayDays,
          nextStep.waitCondition || undefined
        );
      }
```

---

## 3. REST Endpoint Changes (`apps/api/src/index.ts`)
- In `app.post("/api/sequences/:id/steps")`:
  Support serializing and validating `waitCondition` from request body and saving it on the database.
