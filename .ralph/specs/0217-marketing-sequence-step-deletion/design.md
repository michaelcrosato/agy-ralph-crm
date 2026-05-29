# Specification: Marketing Sequence Step Deletion & Cascading Shift Engine - Design

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
export async function deleteMarketingSequenceStep(
  dbStore: any,
  sequenceId: string,
  stepId: string,
  orgId: string,
): Promise<any[]>
```

### Algorithm details:
1. **Fetch & Validate Sequence**:
   - Fetch sequence using `dbStore.marketingSequences.findOne(sequenceId)`.
   - Assert sequence exists and `sequence.orgId === orgId` (RLS check).
2. **Fetch Steps**:
   - Fetch all steps of the sequence using `dbStore.marketingSequenceSteps.findForSequence(sequenceId)`.
   - Ensure the step `stepId` exists in the list. Let this step be `stepToDelete` with current step number `deletedNum`.
   - Assert `step.orgId === orgId` for all steps (RLS check).
3. **Delete Step**:
   - Delete the step record from the database store: `dbStore.marketingSequenceSteps.delete(stepId)`.
   - If `dbStore.marketingSequenceStepBranches` is available, delete any branch configuration for the deleted step: `dbStore.marketingSequenceStepBranches.deleteForStep(stepId)`.
4. **Determine Shifts & Map Old to New Step Numbers**:
   - Initialize a map `oldNumToNewNum: Map<number, number | null>`.
   - For each remaining step:
     - If its original `stepNumber < deletedNum`, its new step number is `stepNumber` (unchanged). Map `stepNumber -> stepNumber`.
     - If its original `stepNumber > deletedNum`, its new step number is `stepNumber - 1` (shifted down). Map `stepNumber -> stepNumber - 1`.
   - Also explicitly map `deletedNum -> null`.
5. **Update Remaining Steps in DB**:
   - For each remaining step:
     - Determine its new step number using our mapping.
     - Determine its new `replyToStepNumber`:
       - If `replyToStepNumber` is set:
         - If it equals `deletedNum`, set it to `null`.
         - If it is greater than `deletedNum`, decrement it by 1.
     - Update the step record in the database.
6. **Update Remaining Step Branches in DB**:
   - For each remaining step, if a branch exists in `marketing_sequence_step_branches`:
     - Update `trueNextStepNumber`:
       - If it equals `deletedNum`, set it to `null`.
       - If it is greater than `deletedNum`, decrement it by 1.
     - Update `falseNextStepNumber`:
       - If it equals `deletedNum`, set it to `null`.
       - If it is greater than `deletedNum`, decrement it by 1.
     - Update the branch record in the database.
7. **Return Updated Steps**:
   - Re-fetch steps for the sequence from the database sorted by `stepNumber` ascending, and return them.

---

## 3. REST Routing Integration
Add route inside `apps/api/src/index.ts`:

```typescript
app.delete("/api/sequences/:id/steps/:stepId", tenantAuth, async (c) => {
  const orgId = c.get("tenantId");
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");

  try {
    const updatedSteps = await deleteMarketingSequenceStep(
      c.get("dbStore"),
      sequenceId,
      stepId,
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
