# Specification: Marketing Sequence Webhook Actions - Design

## 1. Database Schema Additions (`packages/db/src/schema.ts` and `packages/db/src/index.ts`)

### `packages/db/src/schema.ts`
Modify `marketingSequenceSteps` table to support `stepType`, `webhookUrl`, and `webhookPayload` columns, and make `templateId` nullable:
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
    .references(() => emailTemplates.id, { onDelete: "cascade" }), // Nullable
  waitCondition: jsonb("wait_condition"),
  replyToStepNumber: integer("reply_to_step_number"),
  stepType: text("step_type").notNull().default("email"), // "email" | "webhook"
  webhookUrl: text("webhook_url"),
  webhookPayload: text("webhook_payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### `packages/db/src/index.ts`
Update `DBMarketingSequenceStep` interface and database mock store insertion logic to match the schema updates:
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
  stepType: "email" | "webhook";
  webhookUrl?: string | null;
  webhookPayload?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Ensure `dbStore.marketingSequenceSteps.insert` copies `stepType`, `webhookUrl`, and `webhookPayload` to the new step object.

## 2. Core Execution Upgrades (`packages/core/src/index.ts`)
Within `executePendingSequenceSteps`, when a pending step is selected:
```typescript
if (step.stepType === "webhook") {
  if (dbStore.webhookOutbox && step.webhookUrl) {
    const payload = step.webhookPayload || JSON.stringify({
      event: "sequence.step_executed",
      orgId,
      sequenceId: membership.sequenceId,
      membershipId: membership.id,
      stepNumber: nextStepNumber,
      recordType: membership.recordType,
      recordId: membership.recordId,
      recipientEmail: recipientEmail || null,
    });

    await dbStore.webhookOutbox.insert({
      orgId,
      webhookId: "00000000-0000-0000-0000-000000000000",
      payload,
      status: "pending",
      retryCount: 0,
    });
  }

  // Update step advancement and status exactly like standard email step execution
} else {
  // Existing email step processing
}
```

## 3. Hono REST API Upgrades (`apps/api/src/index.ts`)
In `POST /api/sequences/:id/steps`:
- Parse `stepType` (default: `"email"`), `webhookUrl`, `webhookPayload`.
- Validate that `stepType` is either `"email"` or `"webhook"`.
- If `"email"`: Require `templateId`, fetch template, and assert existence.
- If `"webhook"`: Assert `webhookUrl` is a valid string starting with `http://` or `https://`. `templateId` is optional.
- Pass the fields to `dbStore.marketingSequenceSteps.insert`.
