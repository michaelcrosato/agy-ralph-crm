# Specification: Marketing Sequence A/B Split Testing Engine - Requirements

## 1. Functional Requirements

### 1.1 Split Test Definition & Storage
- The system must support defining A/B split tests on steps of a marketing sequence.
- A split test configuration must have:
  - `stepId`: The step it applies to.
  - `variantTemplateId`: The variant (B) email template to test against the step's default (A) template.
  - `splitWeight`: The percentage weight for variant B (e.g., 50 for a 50/50 split).
  - `isActive`: Flag to activate/deactivate the split test.

### 1.2 Split Allocation & Consistency
- When a membership execution processes a step, the engine must check if a split test is active.
- If a split test is active:
  - If the member already has an allocation persisted for this step, use the `allocatedTemplateId`.
  - If no allocation is persisted, randomly allocate the member:
    - Draw a random number between 1 and 100.
    - If the number is <= `splitWeight`, allocate to the variant template (B).
    - Otherwise, allocate to the default template (A).
    - Persist the allocation.
  - Dispatch the chosen template (create email activity tracker, log audit trail, create activity logs).

### 1.3 Tenant RLS Isolation
- Split test configurations and allocations must be strictly isolated by `org_id`.
- Tenant A must never access or modify Tenant B's split tests or allocations.

---

## 2. API Endpoints

### 2.1 GET `/api/sequences/:id/steps/:stepId/split-test`
- Returns split test configuration for a sequence step.

### 2.2 POST `/api/sequences/:id/steps/:stepId/split-test`
- Creates or updates a split test configuration.
- Payload:
  ```json
  {
    "variantTemplateId": "uuid-of-template",
    "splitWeight": 50,
    "isActive": 1
  }
  ```

### 2.3 POST `/api/sequences/:id/steps/:stepId/split-test/allocate`
- Manually forces/persists a split test allocation for a member.
- Payload:
  ```json
  {
    "membershipId": "uuid-of-membership",
    "allocatedTemplateId": "uuid-of-template"
  }
  ```
