# Specification: Marketing Sequence Exit Triggers Engine - Requirements

## 1. Functional Requirements

### 1.1 Trigger Definition & Storage
- The system must support defining exit triggers for any marketing sequence.
- An exit trigger must specify a `triggerType`:
  - `lead_status_changed`: Auto-exits a Lead sequence membership if the Lead's status matches a target status.
  - `opportunity_stage_changed`: Auto-exits a Contact sequence membership if any Opportunity for the Contact's Account matches a target stage.
- Each exit trigger must have a JSONB `criteria` field representing the conditions to match:
  - For `lead_status_changed`: `{ "status": "Converted" }`
  - For `opportunity_stage_changed`: `{ "stage": "Closed Won" }`

### 1.2 Evaluation & Unenrollment Engine
- Before executing any pending sequence step for a membership, the engine must fetch and evaluate the active exit triggers for that sequence.
- If a trigger condition is met:
  - The membership status must be updated to `completed` or `unsubscribed` (preventing any future sequence emails).
  - An audit log entry must be created with action `exit_trigger_fired` showing the membership's state change.
  - The engine must skip executing any further sequence steps for this member during the current execution run.

### 1.3 Multi-Tenant Row-Level Security (RLS)
- All CRUD operations on sequence exit triggers must be strictly isolated by the active tenant ID (`org_id`).
- One tenant must never be able to view, create, or delete exit triggers belonging to another tenant.

---

## 2. API Endpoints

### 2.1 GET `/api/sequences/:id/exit-triggers`
- Returns an array of exit triggers defined for the specified sequence.
- Must validate that the sequence belongs to the active tenant.

### 2.2 POST `/api/sequences/:id/exit-triggers`
- Adds a new exit trigger to a sequence.
- Request payload:
  ```json
  {
    "triggerType": "lead_status_changed",
    "criteria": { "status": "Converted" }
  }
  ```
- Validates the request fields and registers the trigger under the active tenant's context.

### 2.3 DELETE `/api/sequences/:id/exit-triggers/:triggerId`
- Deletes an existing exit trigger.
- Must assert active tenant ownership before deletion.
