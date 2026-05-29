# Task 0121: Lead Assignment Rules & Auto-Routing Engine - Requirements

## Functional Requirements

### 1. Rule & Criteria Management
- Administrators can create multiple Lead Assignment Rules, but only **one** rule can be designated as `isActive` (active) per tenant organization at any given time.
- Each rule contains a sequence of prioritized entries (`lead_assignment_rule_entries`) evaluated in ascending `sortOrder`.
- Each entry defines:
  - `criteria`: A list of field matching conditions. Each condition has `field` (e.g. `company` or `custom.region`), `operator` ("equals" | "contains" | "greater_than" | "less_than"), and `value`.
  - `routingMethod`: "direct" or "round_robin".
  - `routingUserIds`: A list of user IDs involved in routing.
  - `lastAssignedIndex`: A 0-based index pointer tracking the last user in the array who was assigned a lead under this round-robin queue.

### 2. Assignment Evaluation Logic
- When triggering the assignment engine on a Lead record:
  - Find the single active Lead Assignment Rule for the active tenant organization.
  - Evaluate each entry in the rule sequentially by `sortOrder`.
  - For each entry, evaluate its criteria array against the Lead's fields:
    - Standard fields: Evaluated directly.
    - Custom fields: Checked inside the `custom` JSONB record.
    - If all criteria conditions are satisfied:
      - **Direct Assignment**: If `routingMethod` is "direct", assign the lead to the first user ID in `routingUserIds`.
      - **Round-Robin Assignment**: If `routingMethod` is "round_robin", assign the lead to the user in `routingUserIds` at the next circular index following `lastAssignedIndex`. Increment and update `lastAssignedIndex` in the rule entry.
      - Stop processing subsequent entries.
  - If no rule entry matches, the lead's owner remains unchanged.

### 3. REST API Contracts
- `POST /api/lead-assignment-rules`: Create a new assignment rule with entries. If marked active, set all other rules for that tenant organization to inactive.
- `GET /api/lead-assignment-rules`: Fetch all assignment rules for the active tenant context.
- `POST /api/leads/:id/assign`: Evaluate active routing rules for the target lead and perform the update. Return a response payload detailing whether a rule was matched, who the new owner is, and the rule entry that triggered it.

### 4. Tenancy & Row-Level Security
- Strictly isolate routing rules and entries behind active tenant RLS bounds.
- Any request from a user in Tenant A must only fetch or modify rules owned by Tenant A.
- Round-robin assignments must only route leads to users who are members of the same organization.

### 5. Audit Trail Integration
- When a Lead's owner is updated by the assignment engine, record an audit log in the `audit_logs` store with `action` set to "assign", `recordType` set to "leads", `recordId` set to the lead's ID, and `changes` containing the ownership change details.
