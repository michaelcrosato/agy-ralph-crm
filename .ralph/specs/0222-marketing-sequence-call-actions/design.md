# Specification: Marketing Sequence Call Actions - Design

## 1. Database Schema Additions

### 1.1 `marketingSequenceSteps` Table Expansion
We extend the `marketingSequenceSteps` table in `packages/db/src/schema.ts` to include:
- `callScript`: `text("call_script")` column allowing nullable template content.

### 1.2 DB Types Update (`packages/db/src/index.ts`)
Update the `DBMarketingSequenceStep` interface to include:
```typescript
callScript?: string | null;
```
Ensure that the in-memory stubs and type constraints accommodate the `"call"` stepType:
```typescript
export interface DBMarketingSequenceStep {
  // ...
  stepType: "email" | "webhook" | "task" | "sms" | "call";
  callScript?: string | null;
  // ...
}
```

## 2. API Endpoint Changes (`apps/api/src/index.ts`)
Update `POST /api/sequences/:id/steps`:
- Update `stepType` validation check to allow `"call"`.
- Validate that if `stepType === "call"`, `callScript` is provided, non-empty, and a string.
- During database insertion, pass `callScript: stepType === "call" ? body.callScript || null : null`.

## 3. Core Execution Engine (`packages/core/src/index.ts`)
Extend `executePendingSequenceSteps` in `packages/core/src/index.ts` to support `"call"`.
- Define type `CoreSequenceStep` and ensure it accepts `callScript`.
- Add a new block handling `step.stepType === "call"`:
```typescript
if (step.stepType === "call") {
  if (dbStore.activities && step.callScript) {
    const personalized = personalizeEmailTemplate(
      { subject: "Outbound Call", body: step.callScript },
      recipientContext,
    );

    const act = await dbStore.activities.insert({
      orgId,
      creatorId: "00000000-0000-0000-0000-000000000000",
      type: "call",
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
Ensure that step status updates, advancing to next steps, or marking memberships as completed logic processes Call steps seamlessly.
