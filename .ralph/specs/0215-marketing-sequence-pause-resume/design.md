# Specification: Marketing Sequence Pause & Resume API - Design

## 1. Core Logic Additions (`packages/core/src/index.ts`)

```typescript
export async function pauseMarketingSequence(
  dbStore: any,
  sequenceId: string,
  orgId: string,
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "active") {
    throw new Error("Only active sequences can be paused");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "paused",
  });

  return updatedSequence;
}

export async function resumeMarketingSequence(
  dbStore: any,
  sequenceId: string,
  orgId: string,
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "paused") {
    throw new Error("Only paused sequences can be resumed");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "active",
  });

  return updatedSequence;
}
```

### 1.1 Step Execution Engine Bypass
Inside `executePendingSequenceSteps` in `packages/core/src/index.ts`, check the sequence's status right after querying:
```typescript
    if (sequence) {
      if (sequence.status === "paused") {
        continue;
      }
      const validTime = getNextValidSendingTime(
```

## 2. Hono API Routes (`apps/api/src/index.ts`)

- **POST `/api/sequences/:id/pause`**: Pause sequence. Returns the updated sequence object.
- **POST `/api/sequences/:id/resume`**: Resume sequence. Returns the updated sequence object.

Both endpoints must implement multi-tenant checks to ensure RLS is correctly enforced. If a sequence is not found or belongs to another tenant, they return a `404` status code.
