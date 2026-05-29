# Specification: Marketing Sequence Dynamic Branching & Event Paths - Requirements

## 1. Functional Requirements

### 1.1 Branch Rule Storage & Definition
- The CRM must support defining branching logic for any step in a marketing sequence.
- A branching rule configuration must include:
  - `stepId`: The step this branching rule applies to.
  - `branchType`: The condition type, supporting `"email_open"` or `"email_click"`.
  - `evaluationWindowDays`: The waiting time in days before evaluating the condition.
  - `trueNextStepNumber`: The step number to route the membership to if the condition is met.
  - `falseNextStepNumber`: The step number to route the membership to if the condition is NOT met.

### 1.2 Dynamic Routing Engine
- When a sequence step finishes executing (i.e. sending the email), the execution engine must check if a branching rule exists for this step.
- If a branching rule is configured:
  - The membership must be scheduled to resume exactly `evaluationWindowDays` later.
  - The membership status remains `"active"`, and its `currentStepNumber` remains set to the executed step number.
- When the membership is processed after the evaluation window has elapsed:
  - The engine must retrieve the email activity sent during this step and locate its corresponding `emailTrackers` record.
  - If `branchType` is `"email_open"`, the condition is met if `openCount > 0`.
  - If `branchType` is `"email_click"`, the condition is met if `clickCount > 0`.
  - If the condition is met, the next step number to execute is updated to `trueNextStepNumber`.
  - If the condition is not met, the next step number to execute is updated to `falseNextStepNumber`.
  - The engine executes the resolved next step and schedules subsequent steps.

### 1.3 Tenant RLS Isolation
- Branching configurations must be strictly isolated by `org_id`.
- Memberships, email trackers, and branching rules belonging to Tenant A must never be accessible or modifiable by Tenant B.

---

## 2. API Endpoints

### 2.1 GET `/api/sequences/:id/steps/:stepId/branch`
- Returns the branching rule for a specific sequence step.
- Throws 404 if no branch exists.

### 2.2 POST `/api/sequences/:id/steps/:stepId/branch`
- Creates or updates the branching rule for a sequence step.
- Payload:
  ```json
  {
    "branchType": "email_click",
    "evaluationWindowDays": 3,
    "trueNextStepNumber": 3,
    "falseNextStepNumber": 4
  }
  ```

### 2.3 DELETE `/api/sequences/:id/steps/:stepId/branch`
- Deletes a branching rule from a step.
