# Specification: Marketing Sequence Cloning & Template Copying Engine - Design

## 1. API Definition

### 1.1 Duplicate Sequence
`POST /api/sequences/:id/clone`
- **Authentication**: Required (`tenantAuth` middleware).
- **Request Body**:
  ```json
  {
    "name": "Acme Nurture Campaign v2"
  }
  ```
- **Response (Success)**:
  ```json
  {
    "success": true,
    "sequence": {
      "id": "mseq-123xyz",
      "orgId": "org-uuid",
      "name": "Acme Nurture Campaign v2",
      "status": "draft",
      "...": "..."
    }
  }
  ```
- **Response (Error - Not Found / Mismatch)**:
  - Code: `404 Not Found`
  - Body: `{ "success": false, "error": "Sequence not found" }`

## 2. Relational Deep Copy Mapping

When cloning a sequence, the following database stores must be processed in transaction order under the active `orgId`:

1. **`dbStore.marketingSequences`**: Clones the root record.
2. **`dbStore.marketingSequenceSteps`**: Fetches all steps where `sequenceId = originalId`.
   - For each step, inserts a new step record.
   - Saves a mapping of `originalStepId -> clonedStepId` to correctly associate step-level children:
     - **`dbStore.marketingSequenceStepBranches`**: Queries using `findForStep(originalStepId)` and inserts new records pointing to the new step ID.
     - **`dbStore.marketingSequenceStepSplitTests`**: Queries using `findForStep(originalStepId)` and inserts new records pointing to the new step ID.
     - **`dbStore.marketingSequenceLinkActions`**: Queries using `findForStep(originalStepId)` and inserts new records pointing to the new step ID.
     - **`dbStore.marketingSequenceOpenActions`**: Queries using `findForStep(originalStepId)` and inserts new records pointing to the new step ID.
     - **`dbStore.marketingSequenceReplyActions`**: Queries using `findForStep(originalStepId)` and inserts new records pointing to the new step ID.
3. **`dbStore.marketingSequenceExitTriggers`**: Queries using `findForSequence(originalId)` and inserts new records pointing to the new sequence ID.
4. **`dbStore.marketingSequenceTagMappings`**: Queries using `findForSequence(originalId)` and inserts new records pointing to the new sequence ID.

## 3. Core Logic Signature

We will export a core function in `packages/core/src/index.ts` to coordinate this process safely:

```typescript
export async function cloneMarketingSequence(
  dbStore: any,
  sequenceId: string,
  newName: string,
  orgId: string,
): Promise<any>
```
This ensures complete testability of the cloning process at the unit level, separate from Hono's HTTP handlers.
