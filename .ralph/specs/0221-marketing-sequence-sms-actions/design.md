# Specification: Marketing Sequence SMS Actions - Design

## 1. Database Schema Additions

### 1.1 `marketingSequenceSteps` Table Expansion
We extend the `marketingSequenceSteps` table in `packages/db/src/schema.ts` to include:
- `smsMessage`: `text("sms_message")` column allowing nullable/nullable template content.

### 1.2 DB Types Update (`packages/db/src/index.ts`)
Update the `DBMarketingSequenceStep` interface to include:
```typescript
smsMessage?: string | null;
```
Ensure that the in-memory stubs and type constraints accommodate the `"sms"` stepType.

### 1.3 DB Activity Type Extension (`packages/db/src/index.ts` & `packages/core/src/index.ts`)
Extend the allowed `type` property in `DBActivity` to support `"sms"` type:
```typescript
export interface DBActivity {
  id: string;
  orgId: string;
  creatorId: string;
  type: "task" | "call" | "note" | "email" | "sms";
  subject: string;
  body: string | null;
  dueDate: Date | null;
  createdAt: Date;
  custom?: Record<string, unknown> | null;
}
```

## 2. API Endpoint Changes (`apps/api/src/index.ts`)
Update `POST /api/sequences/:id/steps`:
- Update `stepType` validation check to allow `"sms"`.
- Validate that if `stepType === "sms"`, `smsMessage` is provided, non-empty, and a string.
- During database insertion, pass `smsMessage: stepType === "sms" ? body.smsMessage || null : null`.

## 3. Core Execution Engine (`packages/core/src/index.ts`)
Extend `executePendingSequenceSteps`:
- Add a new block handling `step.stepType === "sms"`:
```typescript
if (step.stepType === "sms") {
  if (dbStore.activities && step.smsMessage) {
    const personalized = personalizeEmailTemplate(
      { subject: "Outbound SMS", body: step.smsMessage },
      recipientContext,
    );

    const act = await dbStore.activities.insert({
      orgId,
      creatorId: "00000000-0000-0000-0000-000000000000",
      type: "sms",
      subject: personalized.subject,
      body: personalized.body,
      dueDate: null,
      custom: null,
    });

    if (dbStore.activityLinks && act?.id) {
      const targetType =
        membership.recordType === "lead"
          ? "Lead"
          : membership.recordType === "contact"
            ? "Contact"
            : "Lead";

      await dbStore.activityLinks.insert({
        orgId,
        activityId: act.id,
        targetType,
        targetId: membership.recordId,
      });
    }
  }
}
```
Ensure that step status updates, advancing to next steps, or marking memberships as completed logic processes SMS steps seamlessly.
