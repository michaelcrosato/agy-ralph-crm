# Spec 0125: Opportunity Stage History & Velocity Tracking API Design

## Database Schema (Drizzle Representation)

### `opportunity_stage_history` Table
```typescript
export const opportunityStageHistory = pgTable("opportunity_stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  fromStage: text("from_stage"), // Nullable on creation
  toStage: text("to_stage").notNull(),
  amount: text("amount"), // Historical amount at transition time
  changedById: uuid("changed_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

---

## Core Analytics Interfaces

```typescript
export interface StageHistoryInput {
  opportunityId: string;
  fromStage: string | null;
  toStage: string;
  createdAt: Date;
}

export interface StageDuration {
  stage: string;
  totalDurationMs: number;
  transitionCount: number;
  averageDurationDays: number;
}

export function calculateStageVelocity(
  history: StageHistoryInput[],
  now: Date = new Date()
): Record<string, StageDuration>;
```

---

## REST Endpoints

### 1. `GET /api/opportunities/:id/stage-history`
* **Route**: `/api/opportunities/:id/stage-history`
* **Description**: Lists all historical transitions for a specific Opportunity.
* **Return Value**: Array of stage history entries, ordered chronologically.

### 2. `GET /api/reports/stage-velocity`
* **Route**: `/api/reports/stage-velocity`
* **Description**: Returns the average number of days opportunities spend in each stage within the current tenant.
* **Return Value**: JSON object containing average durations per stage.
