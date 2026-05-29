# Specification: Marketing Sequence Dynamic Branching & Event Paths - Design

## 1. Schema Additions (`packages/db/src/schema.ts`)

We will add a new database table `marketingSequenceStepBranches` to store branching configurations for steps:

```typescript
export const marketingSequenceStepBranches = pgTable(
  "marketing_sequence_step_branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    branchType: text("branch_type").notNull(), // "email_open" | "email_click"
    evaluationWindowDays: integer("evaluation_window_days").notNull().default(3),
    trueNextStepNumber: integer("true_next_step_number").notNull(),
    falseNextStepNumber: integer("false_next_step_number").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);
```

## 2. Core Business Logic (`packages/core/src/index.ts`)

### 2.1 Types
We will declare the interface for the branch configuration:

```typescript
export interface CoreStepBranch {
  id: string;
  orgId: string;
  stepId: string;
  branchType: string;
  evaluationWindowDays: number;
  trueNextStepNumber: number;
  falseNextStepNumber: number;
}
```

### 2.2 executePendingSequenceSteps
We will update `executePendingSequenceSteps` in `packages/core/src/index.ts` to:
1. Accept `marketingSequenceStepBranches` in the `dbStore` parameter.
2. In the main evaluation block, before executing a new step:
   - Check if the *current step* (`membership.currentStepNumber`, if > 0) has an active branching rule.
   - If it does, we evaluate the condition:
     - Find the email activity logged for the membership and the branching step (using the standard activities, activity links, and email trackers).
     - Check if `openCount > 0` (for `"email_open"`) or `clickCount > 0` (for `"email_click"`).
     - If the condition is met, we set the next step to run to `trueNextStepNumber`.
     - Else, we set it to `falseNextStepNumber`.
   - If no branching rule exists for `membership.currentStepNumber`, the next step is `membership.currentStepNumber + 1`.
3. When scheduling the subsequent execution after running a step:
   - Check if the step we *just executed* has an active branching rule.
   - If it does, we set the membership's `nextExecutionAt` to `currentTime + evaluationWindowDays` (delaying evaluation), but we DO NOT increment the `currentStepNumber` to the next step yet (we set it to the step we just executed so that when it resumes, we evaluate that step's branch!).
   - If it does not, we schedule the next step normally using its `delayDays` and increment `currentStepNumber`.

## 3. REST API Routes (`apps/api/src/index.ts`)

Expose these Hono endpoints:
- `GET /api/sequences/:id/steps/:stepId/branch`
- `POST /api/sequences/:id/steps/:stepId/branch`
- `DELETE /api/sequences/:id/steps/:stepId/branch`
