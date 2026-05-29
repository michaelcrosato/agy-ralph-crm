# Specification: Marketing Sequence Archiving & Deletion Engine - Design

## 1. API Definition

### 1.1 Archive Sequence
`POST /api/sequences/:id/archive`
- **Authentication**: Required (`tenantAuth` middleware).
- **Response (Success)**:
  ```json
  {
    "success": true,
    "sequence": {
      "id": "seq-123",
      "orgId": "tenant-uuid",
      "name": "Finished Q1 Drip",
      "status": "archived",
      "...": "..."
    }
  }
  ```
- **Response (Error - Not Found / Tenant Mismatch)**:
  - Code: `404 Not Found`
  - Body: `{ "success": false, "error": "Sequence not found" }`

### 1.2 Purge Sequence
`DELETE /api/sequences/:id/purge`
- **Authentication**: Required (`tenantAuth` middleware).
- **Response (Success)**:
  ```json
  {
    "success": true,
    "message": "Sequence purged successfully"
  }
  ```
- **Response (Error - Not Archived)**:
  - Code: `400 Bad Request`
  - Body: `{ "success": false, "error": "Only archived sequences can be purged" }`
- **Response (Error - Not Found / Tenant Mismatch)**:
  - Code: `404 Not Found`
  - Body: `{ "success": false, "error": "Sequence not found" }`

## 2. Core Logic Signatures

We will export two new functions in `packages/core/src/index.ts`:

```typescript
export async function archiveMarketingSequence(
  dbStore: any,
  sequenceId: string,
  orgId: string,
): Promise<any>

export async function purgeMarketingSequence(
  dbStore: any,
  sequenceId: string,
  orgId: string,
): Promise<boolean>
```

### 2.1 Archiving Sequence Logic
1. Fetch the sequence using `dbStore.marketingSequences.findOne(sequenceId)`.
2. Assert existence and tenant RLS isolation: if `sequence.orgId !== orgId`, throw tenant mismatch error.
3. Update the sequence status to `"archived"`.
4. Fetch all memberships. If `dbStore.marketingSequenceMemberships.findMany` is available:
   - Filter memberships where `sequenceId === sequenceId`.
   - For each membership, if status is `"active"` or `"paused"`, update to `"completed"` using `dbStore.marketingSequenceMemberships.update`.

### 2.2 Purging Sequence Logic
1. Fetch the sequence using `dbStore.marketingSequences.findOne(sequenceId)`.
2. Assert existence and tenant RLS: if `sequence.orgId !== orgId`, throw tenant mismatch error.
3. Assert sequence `status === "archived"`. If not, throw `"Only archived sequences can be purged"`.
4. Delete all child records:
   - For steps: Find all steps for this sequence. For each step:
     - Delete branches pointing to this step.
     - Delete split tests pointing to this step.
     - Delete open actions pointing to this step.
     - Delete reply actions pointing to this step.
     - Delete link actions pointing to this step.
     - Delete the step record.
   - Delete all exit triggers for this sequence.
   - Delete all tag mappings for this sequence.
   - Delete all memberships for this sequence.
5. Delete the root sequence record using `dbStore.marketingSequences.delete` or filter-out from mockDb.

## 3. Enrollment Validation
We will add an explicit guard in the `enrollInSequence` method inside `packages/core/src/index.ts`:
```typescript
if (seq.status === "archived") {
  throw new Error("Cannot enroll in an archived sequence");
}
```
This blocks any future enrollments immediately.
