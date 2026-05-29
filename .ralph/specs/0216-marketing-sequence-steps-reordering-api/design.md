# Specification: Marketing Sequence Steps Reordering API - Design

## 1. Database & Schema Verification
We use the existing tables from `packages/db/src/schema.ts`:
- `marketing_sequences`: `id`, `org_id`, `status`
- `marketing_sequence_steps`: `id`, `org_id`, `sequence_id`, `step_number`, `reply_to_step_number`
- `marketing_sequence_step_branches`: `id`, `org_id`, `step_id`, `true_next_step_number`, `false_next_step_number`

No schema changes are required as we leverage existing relational columns.

---

## 2. Core Business Logic Method
In `packages/core/src/index.ts`, we export the following core method:

```typescript
export async function reorderMarketingSequenceSteps(
  dbStore: any,
  sequenceId: string,
  stepId: string,
  newStepNumber: number,
  orgId: string,
): Promise<any[]>
```

### Algorithm details:
1. **Fetch & Validate Sequence**:
   - Fetch sequence using `dbStore.marketingSequences.findOne(sequenceId)`.
   - Assert sequence exists and `sequence.orgId === orgId` (RLS check).
2. **Fetch Steps**:
   - Fetch all steps of the sequence using `dbStore.marketingSequenceSteps.findForSequence(sequenceId)`.
   - Ensure step `stepId` exists in the list.
   - Assert `step.orgId === orgId` for all steps (RLS check).
3. **Sort & Validate Range**:
   - Sort steps ascending by `stepNumber`.
   - Let total steps count be `N`.
   - Assert `newStepNumber >= 1 && newStepNumber <= N`.
4. **Determine Shifts & Map Old to New Step Numbers**:
   - Find target step in the sorted array. Let its current step number be `oldNum`.
   - If `oldNum === newStepNumber`, return current steps.
   - Initialize a map `stepIdToNewNum: Map<string, number>`.
   - Initialize a map `oldNumToNewNum: Map<number, number>`.
   - For each step:
     - If step matches `stepId`, its new step number is `newStepNumber`.
     - Else if `oldNum > newStepNumber` (moving up):
       - If `step.stepNumber >= newStepNumber && step.stepNumber < oldNum`, its new step number is `step.stepNumber + 1`.
       - Else, its new step number is `step.stepNumber`.
     - Else if `oldNum < newStepNumber` (moving down):
       - If `step.stepNumber > oldNum && step.stepNumber <= newStepNumber`, its new step number is `step.stepNumber - 1`.
       - Else, its new step number is `step.stepNumber`.
     - Store in maps.
5. **Update Steps in DB**:
   - Update `step_number` for each step to its new value.
   - Update `reply_to_step_number`:
     - If a step has `replyToStepNumber` set, look up the old step number's new number using `oldNumToNewNum` and set `replyToStepNumber = newReplyNum`.
6. **Update Step Branches in DB**:
   - For each step, if `dbStore.marketingSequenceStepBranches` is available, fetch branch for step.
   - If a branch exists:
     - Update `trueNextStepNumber` to `oldNumToNewNum.get(branch.trueNextStepNumber) || branch.trueNextStepNumber`.
     - Update `falseNextStepNumber` to `oldNumToNewNum.get(branch.falseNextStepNumber) || branch.falseNextStepNumber`.
7. **Return Updated Steps**:
   - Re-fetch steps sorted by `stepNumber` and return them.

---

## 3. REST Routing Integration
Add route inside `apps/api/src/index.ts`:

```typescript
app.post("/api/sequences/:id/steps/:stepId/reorder", tenantAuth, async (c) => {
  const orgId = c.get("tenantId");
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const { newStepNumber } = await c.req.json();

  if (typeof newStepNumber !== "number") {
    return c.json({ error: "Invalid newStepNumber" }, 400);
  }

  try {
    const updatedSteps = await reorderMarketingSequenceSteps(
      c.get("dbStore"),
      sequenceId,
      stepId,
      newStepNumber,
      orgId,
    );
    return c.json({ success: true, steps: updatedSteps });
  } catch (err: any) {
    if (err.message.includes("RLS Isolation Violation") || err.message.includes("Tenant mismatch")) {
      return c.json({ error: err.message }, 403);
    }
    if (err.message.includes("not found")) {
      return c.json({ error: err.message }, 404);
    }
    return c.json({ error: err.message }, 400);
  }
});
```
