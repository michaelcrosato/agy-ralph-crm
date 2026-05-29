# Specification: Marketing Sequence Exit Triggers Engine - Design

## 1. Schema Additions (`packages/db/src/schema.ts`)

We will add a new table `marketingSequenceExitTriggers` to define automated unenrollment triggers:

```typescript
export const marketingSequenceExitTriggers = pgTable("marketing_sequence_exit_triggers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => marketingSequences.id, { onDelete: "cascade" }),
  triggerType: text("trigger_type").notNull(), // "lead_status_changed" | "opportunity_stage_changed"
  criteria: jsonb("criteria").notNull(), // e.g. { status: "Converted" } or { stage: "Closed Won" }
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

---

## 2. Core Business Logic (`packages/core/src/index.ts`)

We will introduce a helper function `shouldExitSequence` to evaluate exit triggers against recipient data:

```typescript
export interface CoreExitTrigger {
  id: string;
  orgId: string;
  sequenceId: string;
  triggerType: string;
  criteria: any;
  isActive: number;
}

export function shouldExitSequence(params: {
  recordType: "lead" | "contact";
  lead: any;
  opportunities: any[];
  triggers: CoreExitTrigger[];
}): boolean {
  for (const trigger of triggers) {
    if (trigger.isActive !== 1) continue;

    if (trigger.triggerType === "lead_status_changed" && params.recordType === "lead" && params.lead) {
      const targetStatus = trigger.criteria?.status;
      if (targetStatus && params.lead.status === targetStatus) {
        return true;
      }
    }

    if (trigger.triggerType === "opportunity_stage_changed" && params.recordType === "contact") {
      const targetStage = trigger.criteria?.stage;
      if (targetStage) {
        const hasMatchingOpp = params.opportunities.some(opp => opp.stage === targetStage);
        if (hasMatchingOpp) {
          return true;
        }
      }
    }
  }
  return false;
}
```

We will also update `executePendingSequenceSteps` in `packages/core/src/index.ts` to support fetching `marketingSequenceExitTriggers` and `opportunities` and calling `shouldExitSequence` before dispatching steps.

---

## 3. API Routing (`apps/api/src/index.ts`)

We will expose the following endpoints under `apps/api/src/index.ts`:

- **GET `/api/sequences/:id/exit-triggers`**: Fetches all active triggers for a sequence.
- **POST `/api/sequences/:id/exit-triggers`**: Creates an exit trigger.
- **DELETE `/api/sequences/:id/exit-triggers/:triggerId`**: Deletes an exit trigger.
