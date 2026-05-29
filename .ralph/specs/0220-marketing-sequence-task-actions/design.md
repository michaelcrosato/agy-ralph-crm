# Specification: Marketing Sequence Task Actions - Design

## 1. Schema Modifications (`packages/db/src/schema.ts` & stubs in `packages/db/src/index.ts`)

We will extend `marketingSequenceSteps` to store task-specific configuration parameters:
- `taskSubject`: `text("task_subject")`
- `taskBody`: `text("task_body")`
- `taskDueDays`: `integer("task_due_days")`

### Database Drizzle Schema Updates

```typescript
export const marketingSequenceSteps = pgTable("marketing_sequence_steps", {
  // ... existing fields ...
  stepType: text("step_type").notNull().default("email"), // "email" | "webhook" | "task"
  webhookUrl: text("webhook_url"),
  webhookPayload: text("webhook_payload"),
  taskSubject: text("task_subject"),
  taskBody: text("task_body"),
  taskDueDays: integer("task_due_days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### In-Memory DB Types & Stubs (`packages/db/src/index.ts`)

```typescript
export interface DBMarketingSequenceStep {
  id: string;
  orgId: string;
  sequenceId: string;
  stepNumber: number;
  delayDays: number;
  templateId: string | null;
  waitCondition?: {
    waitType: "day_of_week" | "duration";
    daysOfWeek?: number[];
    timeOfDay?: string;
  } | null;
  replyToStepNumber?: number | null;
  stepType: "email" | "webhook" | "task";
  webhookUrl?: string | null;
  webhookPayload?: string | null;
  taskSubject?: string | null;
  taskBody?: string | null;
  taskDueDays?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
```

## 2. Core Business Logic updates (`packages/core/src/index.ts`)

Inside `executePendingSequenceSteps`, when `step.stepType === "task"`, we will execute the following logic:
1. Retrieve the enrolled recipient (Lead or Contact) details to construct `recipientContext` and obtain their `ownerId`.
2. Apply `personalizeEmailTemplate` to customize the task's subject and description/body:
   ```typescript
   const personalized = personalizeEmailTemplate(
     { subject: step.taskSubject || "", body: step.taskBody || "" },
     recipientContext,
   );
   ```
3. Calculate the activity due date:
   ```typescript
   let dueDate: Date | null = null;
   if (step.taskDueDays !== undefined && step.taskDueDays !== null) {
     dueDate = new Date(currentTime.getTime() + step.taskDueDays * 24 * 60 * 60 * 1000);
   }
   ```
4. Insert a new activity record of type `"task"` using `dbStore.activities.insert`:
   ```typescript
   const activity = await dbStore.activities.insert({
     orgId,
     creatorId: "00000000-0000-0000-0000-000000000000",
     ownerId: recordOwnerId || "00000000-0000-0000-0000-000000000000",
     type: "task",
     subject: personalized.subject,
     body: personalized.body,
     dueDate,
   });
   ```
5. Insert a new activity link to connect the activity with the recipient:
   ```typescript
   if (dbStore.activityLinks) {
     await dbStore.activityLinks.insert({
       orgId,
       activityId: activity.id,
       targetType: membership.recordType,
       targetId: membership.recordId,
     });
   }
   ```
6. Update sequence membership status and step execution counters.

## 3. Hono REST Endpoints (`apps/api/src/index.ts`)

Update `/api/sequences/:id/steps` (POST):
- Accept `stepType: "task"`.
- Validate `taskSubject` is provided and non-empty.
- Insert the new fields into Drizzle `dbStore.marketingSequenceSteps.insert`.
