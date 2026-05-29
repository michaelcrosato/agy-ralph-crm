# Specification: Marketing Sequence Steps Reordering API - Requirements

## 1. Functional Requirements

### 1.1 Step Shifting & Consistency
- **Consecutive Numbers**: Steps must always have contiguous, 1-indexed `stepNumber` values (e.g. 1, 2, 3...). Gaps or duplicate step numbers are invalid.
- **Boundaries**: The `newStepNumber` must be between `1` and `N` (inclusive), where `N` is the total number of steps in the sequence. If out of bounds, throw an error.
- **Directional Shift**:
  - **Moving Up (e.g., Step 4 to 2)**: Steps 2 and 3 must shift down (increment by 1). Step 4 becomes Step 2.
  - **Moving Down (e.g., Step 2 to 4)**: Steps 3 and 4 must shift up (decrement by 1). Step 2 becomes Step 4.

### 1.2 References Update & Integrity
- **Reply References**:
  - When `stepNumber` values change, any step's `replyToStepNumber` referencing a shifted step must be updated to reference its *new* `stepNumber`.
- **Branching References**:
  - In `marketing_sequence_step_branches`, the `trueNextStepNumber` and `falseNextStepNumber` fields reference the step numbers of target steps.
  - These fields must be updated dynamically according to the remapped step numbers.

### 1.3 Tenant Isolation (RLS)
- The reordering process must enforce strict tenant RLS isolation:
  - The sequence must belong to the active tenant `orgId`.
  - All shifted steps must belong to the active tenant `orgId`.
  - Mismatched `orgId` values must throw an absolute tenant mismatch error.

---

## 2. API Contract Requirements

### 2.1 Reorder Step Endpoint
- **URL**: `POST /api/sequences/:id/steps/:stepId/reorder`
- **Headers**:
  - `Content-Type: application/json`
  - `x-tenant-org-id`: Active tenant identifier.
- **Payload**:
  ```json
  {
    "newStepNumber": 2
  }
  ```
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
  - **400 Bad Request**: Missing or invalid parameters, out-of-bounds `newStepNumber`.
  - **403 Forbidden**: Tenant isolation breach.
  - **444 Not Found**: Sequence or step not found.
