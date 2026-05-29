# Specification: Marketing Sequence Email Reply Triggers - Requirements

## 1. Functional Requirements

### 1.1 Reply Action Configuration
- Users MUST be able to define one or more reply action rules for any marketing sequence step.
- Each reply action rule MUST contain:
  - `actionType`: The type of action to execute. Must be either `field_update` or `create_task`.
  - `actionConfig`: A JSON object detailing the action parameters:
    - For `field_update`: `field` (string) and `value` (string) representing the field name and new value to write to the recipient record.
    - For `create_task`: `subject` (string), `body` (string, optional), and `dueDateOffsetDays` (number, optional) representing the task properties.

### 1.2 Action Execution Engine
- When a reply tracking endpoint receives a valid reply event (via `token`), it MUST resolve:
  - The `emailTrackers` record to find the parent `activityId`.
  - The `activityLinks` to find the recipient record (Lead or Contact).
  - The `marketingSequenceMemberships` matching the recipient record (`recordId`, `recordType`) and tenant org.
  - The active `marketingSequenceSteps` that sent this email (resolved by finding the index of the opened `activityId` among all sequence emails sent to the recipient, sorted chronologically by ID).
- Upon receiving a reply, the engine MUST automatically transition the sequence membership status to `completed` and write an audit log entry for this transition.
- The engine MUST query all `marketing_sequence_reply_actions` configured for that sequence step.
- The engine MUST evaluate and execute all configured actions.
- **Field Update Execution**:
  - Update the recipient (Lead or Contact) record. Supports standard fields and custom JSONB attributes (`custom.*`).
- **Create Task Execution**:
  - Insert a new `task` activity with the specified subject, body, and due date calculated using the offset from current time.
  - Link the task to the recipient record via `activityLinks`.
- **Audit Logging**:
  - Insert an audit log entry for the membership record with action `reply_trigger_executed`, showing the changes applied.

### 1.3 Tenant RLS Isolation
- A tenant MUST NOT be able to query, create, or delete reply actions belonging to another tenant.
- An email reply trigger execution MUST execute strictly within the active organization context. It MUST NOT affect or update records belonging to other tenants.
