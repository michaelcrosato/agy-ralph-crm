# Specification: Marketing Sequence Score-Based Automation Triggers - Requirements

## 1. Functional Requirements

### 1.1 Score Triggers & Threshold Evaluation
- The system MUST support configuring one or more score-based triggers for a marketing sequence.
- Each trigger MUST specify:
  1. `scoreThreshold` (integer): The minimum composite `engagementScore` required to fire the trigger.
  2. `actionType` (string): The action to perform. Valid types are:
     - `"change_lead_status"`: Updates the associated Lead's status.
     - `"auto_exit"`: Auto-completes the sequence membership.
     - `"notify_owner"`: Creates a follow-up CRM task for the record's owner.
  3. `actionConfig` (JSON/object): Configuration parameters for the action, such as the target status value or task details.
- Trigger evaluation MUST happen automatically and in real-time when the membership's score is updated or manually recalculated.
- A trigger MUST NOT fire more than once for a given sequence membership (to prevent duplicate task creation or status updates if the score fluctuates). We should track fired triggers, or simply verify that once an action is taken (e.g. status changed or exited), duplicate executions are avoided. To keep the implementation clean and elegant, we can check if the action has already been applied (e.g., Lead status is already updated, or member has already completed/exited).

### 1.2 Action Execution Primitives
- **Lead Status Transition (`"change_lead_status"`)**:
  - If the membership record is a `"lead"` (not `"contact"`), update the Lead's status field to `actionConfig.status` in the database.
  - If the membership is a `"contact"`, this action has no effect (fails silently or logs a skip).
- **Auto-Exit (`"auto_exit"`)**:
  - Transition the membership's `status` field to `"completed"`.
  - Set `nextExecutionAt` or snooze fields to prevent further sequence step execution.
- **Owner Notification (`"notify_owner"`)**:
  - Locate the owner of the Lead or Contact (`ownerId`).
  - Create a new task activity in the `activities` store with:
    - `type: "task"`
    - `creatorId: "system"`
    - `subject`: Configurable, or default to `"[High Engagement] Follow up with Lead/Contact"`
    - `body`: A description indicating the engagement score and sequence information.
    - `dueDate`: e.g. 1 day from now.
  - Link the activity to the corresponding Lead or Contact using `activityLinks`.

### 1.3 Tenant RLS Isolation
- Score triggers and execution MUST be strictly isolated by the active tenant org context (`orgId`).
- Tenant A must never be able to configure, retrieve, or trigger execution of Tenant B's triggers.
- Trigger actions (e.g. updating leads, inserting tasks) must run in the tenant context and fail if they attempt to access records outside the tenant.

## 2. Interface Contracts

### 2.1 API Endpoint Definitions

#### POST /api/sequences/:id/triggers
- Secure route with `tenantAuth`.
- Path Parameter: `id` (UUID of the marketing sequence).
- Request Body:
  ```json
  {
    "scoreThreshold": 15,
    "actionType": "change_lead_status",
    "actionConfig": {
      "status": "Qualified"
    }
  }
  ```
- Response: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "id": "trigger-uuid-1",
      "orgId": "tenant-uuid",
      "sequenceId": "sequence-uuid",
      "scoreThreshold": 15,
      "actionType": "change_lead_status",
      "actionConfig": {
        "status": "Qualified"
      }
    }
  }
  ```

#### GET /api/sequences/:id/triggers
- Secure route with `tenantAuth`.
- Path Parameter: `id` (UUID of the marketing sequence).
- Response: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "trigger-uuid-1",
        "orgId": "tenant-uuid",
        "sequenceId": "sequence-uuid",
        "scoreThreshold": 15,
        "actionType": "change_lead_status",
        "actionConfig": {
          "status": "Qualified"
        }
      }
    ]
  }
  ```

#### DELETE /api/sequences/triggers/:id
- Secure route with `tenantAuth`.
- Path Parameter: `id` (UUID of the score trigger).
- Response: `200 OK`
  ```json
  {
    "success": true,
    "message": "Score trigger deleted successfully"
  }
  ```
