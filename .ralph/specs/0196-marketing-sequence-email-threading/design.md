# Specification: Marketing Sequence Email Threading - Design

## 1. Database Additions

### 1.1 Schema Table Extension (`packages/db/src/schema.ts`)
We will add `replyToStepNumber` to the Drizzle definition of `marketingSequenceSteps`:

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
  waitCondition: jsonb("wait_condition"),
  replyToStepNumber: integer("reply_to_step_number"), // Added column
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### 1.2 In-Memory DB Store Updates (`packages/db/src/index.ts`)
We will update `packages/db/src/index.ts`:
- Extend `DBMarketingSequenceStep` interface:
  ```typescript
  export interface DBMarketingSequenceStep {
    id: string;
    orgId: string;
    sequenceId: string;
    stepNumber: number;
    delayDays: number;
    templateId: string;
    waitCondition: unknown | null;
    replyToStepNumber?: number | null; // Added field
    createdAt: Date;
    updatedAt: Date;
  }
  ```
- Ensure standard mock database CRUD and verification operations in `marketingSequenceSteps` handle the `replyToStepNumber` correctly.

## 2. Core Worker Engine Upgrades (`packages/core/src/index.ts`)

Inside `executePendingSequenceSteps`, when executing a step:
1. Check if the step has a configured `replyToStepNumber`:
   ```typescript
   let finalSubject = compiled.subject;
   const customAttributes: Record<string, unknown> = {};

   if (step.replyToStepNumber && step.replyToStepNumber >= 1) {
     // 1. Find the target step in the sequence
     const siblingSteps = await dbStore.marketingSequenceSteps.findMany();
     const targetStep = siblingSteps.find(
       (s) =>
         s.sequenceId === step.sequenceId &&
         s.stepNumber === step.replyToStepNumber &&
         s.orgId === orgId
     );

     if (targetStep) {
       // 2. Find matching activity created for this recipient by the target step
       const activities = await dbStore.activities.findMany();
       const links = await dbStore.activityLinks.findMany();

       // Map link-to-activity relationships for speed/correctness
       const targetLinks = links.filter(
         (l) =>
           l.orgId === orgId &&
           l.targetType === (membership.recordType === "lead" ? "Lead" : "Contact") &&
           l.targetId === membership.recordId
       );

       const targetActivityIds = new Set(targetLinks.map((l) => l.activityId));
       const parentActivity = activities.find(
         (a) =>
           targetActivityIds.has(a.id) &&
           a.orgId === orgId &&
           a.type === "email" &&
           a.subject &&
           (targetStep.templateId ? a.subject.includes(a.subject) : true) // or verify via custom attributes
       );

       if (parentActivity) {
         // Prefix subject with "Re: " if not already present
         const startsWithRe = /^re:/i.test(parentActivity.subject);
         finalSubject = startsWithRe
           ? parentActivity.subject
           : `Re: ${parentActivity.subject}`;

         customAttributes.parent_activity_id = parentActivity.id;
       }
     }
   }
   ```
2. Set `subject: finalSubject` and `custom: customAttributes` in the inserted activity.

## 3. REST API Upgrades (`apps/api/src/index.ts`)

- In `POST /api/sequence-steps`:
  - Validate `replyToStepNumber` if provided:
    - Must be an integer.
    - Must be $\ge 1$.
    - Must be strictly less than `stepNumber`.
    - Verify that a step with `stepNumber === replyToStepNumber` exists in the sequence.
- In `PATCH /api/sequence-steps/:id`:
  - Enforce the same validation rules during step edits.
