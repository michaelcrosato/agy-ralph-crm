# Specification: Marketing Sequence Step Deletion & Cascading Shift Engine - Requirements

## 1. Functional Requirements

### 1.1 Step Deletion & Shifting
- **Step Removal**: The target step with `stepId` must be completely removed from the database store.
- **Consecutive Numbers**: Subsequent steps (those with `stepNumber` greater than the deleted step's `stepNumber`) must have their `stepNumber` decremented by exactly 1.
- **Contiguity Guarantee**: After deletion, the remaining steps in the sequence must have contiguous, 1-indexed `stepNumber` values from `1` to `N` (where `N` is the new total number of steps in the sequence). Gaps or duplicate step numbers are strictly forbidden.

### 1.2 References Update & Integrity
- **Reply References**:
  - If any remaining step's `replyToStepNumber` equals the deleted step's original `stepNumber`, set it to `null`.
  - If any remaining step's `replyToStepNumber` is greater than the deleted step's original `stepNumber`, decrement it by exactly 1 to preserve the reply link to the shifted step.
- **Branching References**:
  - Delete any branch in `marketing_sequence_step_branches` that belongs to the deleted step (where `stepId` matches the deleted step).
  - In `marketing_sequence_step_branches`, update `trueNextStepNumber` and `falseNextStepNumber` for all remaining branches:
    - If `trueNextStepNumber` or `falseNextStepNumber` equals the deleted step's original `stepNumber`, set it to `null`.
    - If `trueNextStepNumber` or `falseNextStepNumber` is greater than the deleted step's original `stepNumber`, decrement it by exactly 1.

### 1.3 Tenant Isolation (RLS)
- The deletion process must enforce strict tenant RLS isolation:
  - The sequence must belong to the active tenant `orgId`.
  - The step being deleted, all remaining steps, and their branches must belong to the active tenant `orgId`.
  - Mismatched `orgId` values must throw an absolute tenant mismatch error.

---

## 2. API Contract Requirements

### 2.1 Delete Step Endpoint
- **URL**: `DELETE /api/sequences/:id/steps/:stepId`
- **Headers**:
  - `x-tenant-org-id`: Active tenant identifier.
- **Responses**:
  - **200 OK**:
    ```json
    {
      "success": true,
      "steps": [
        { "id": "...", "stepNumber": 1 },
        { "id": "...", "stepNumber": 2 }
      ]
    }
    ```
  - **403 Forbidden**: Tenant isolation breach.
  - **444 Not Found**: Sequence or step not found.
  - **400 Bad Request**: Invalid parameters or execution error.
