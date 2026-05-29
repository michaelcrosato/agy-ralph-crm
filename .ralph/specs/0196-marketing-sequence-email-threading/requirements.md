# Specification: Marketing Sequence Email Threading - Requirements

## 1. Functional Requirements

### 1.1 Step Schema Extension
- Each marketing sequence step MUST support a `replyToStepNumber` property.
- `replyToStepNumber` is optional and represents the step number in the same sequence that the current step replies to.

### 1.2 Configuration Validation (REST API)
- When creating or updating a sequence step via the API, the system MUST validate that:
  - If `replyToStepNumber` is provided, it is a valid integer.
  - `replyToStepNumber` MUST be strictly less than the current step's `stepNumber`.
  - `replyToStepNumber` MUST be greater than or equal to `1`.
  - The sequence step pointed to by `replyToStepNumber` MUST exist in the database (or be part of the request payload) for that sequence.

### 1.3 Execution & Thread Resolution
- During sequence execution (`executePendingSequenceSteps`), if the current step has a `replyToStepNumber` configured, the engine MUST:
  1. Find the sequence step record matching that `replyToStepNumber` in the sequence.
  2. Find the email activity created for this specific recipient (`recordType`/`recordId`) as part of the execution of that target step.
  3. If a matching parent activity is found:
     - The subject of the new activity MUST be set to `"Re: " + parentActivity.subject` (case-insensitive check: if the parent subject already starts with `"Re: "` or `"re: "`, do not double-prefix it).
     - The new activity MUST store the parent activity's ID in its `custom` JSONB block as `parent_activity_id`.
  4. If no parent activity is found (e.g., the step was skipped or error occurred previously), the engine MUST fall back to the system default subject (no prefix) and log the event.

### 1.4 Tenant RLS Isolation
- Tenant isolation MUST be strictly enforced:
  - A tenant MUST NOT be able to link or resolve parent activities belonging to another tenant.
  - Verification of parent activities and sequence steps MUST execute within the active organization context.
