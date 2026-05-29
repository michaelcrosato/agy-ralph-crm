# Specification: Marketing Sequence Cloning & Template Copying Engine - Requirements

## 1. Functional Requirements

### 1.1 Sequence Record Cloning
- **REQ-1.1.1**: The system must support deep-cloning an existing marketing sequence.
- **REQ-1.1.2**: The cloned sequence's `name` must be customizable via the request body. If no name is provided, it must default to `"{Original Name} - Copy"`.
- **REQ-1.1.3**: The cloned sequence must always start in `"draft"` status, regardless of the original sequence's status.
- **REQ-1.1.4**: All core fields of the sequence must be duplicated exactly: `description`, `sendingWindowStart`, `sendingWindowEnd`, `sendingDays`, `allowReenrollment`, `reenrollmentMinDays`, `dailySendLimit`, `senderType`, `senderUserId`, and `folderId`.

### 1.2 Step & Branch Cloning
- **REQ-1.2.1**: The system must clone all steps associated with the original sequence (`marketing_sequence_steps`).
- **REQ-1.2.2**: Cloned steps must maintain the correct `stepNumber` order and duplicate all fields: `delayDays`, `templateId`, `waitCondition`, and `replyToStepNumber`.
- **REQ-1.2.3**: The system must clone all step branches (`marketing_sequence_step_branches`) associated with each step.
- **REQ-1.2.4**: The system must clone all A/B split tests (`marketing_sequence_step_split_tests`) associated with each step.
- **REQ-1.2.5**: The system must clone all actions (link, open, and reply actions) associated with each step.

### 1.3 Trigger, Goal & Tag Linkage Cloning
- **REQ-1.3.1**: The system must clone all exit triggers (`marketing_sequence_exit_triggers`) associated with the original sequence.
- **REQ-1.3.2**: The system must clone all tag mappings (`marketing_sequence_tag_mappings`) associated with the original sequence.

### 1.4 REST API Endpoints
- **REQ-1.4.1**: `POST /api/sequences/:id/clone` - Clone a sequence. Accepts an optional JSON body with `{ name: string }`.

## 2. Security & Verification Requirements
- **REQ-2.1**: Tenant RLS: A tenant must NEVER be allowed to clone, read, or copy sequences or steps belonging to another organization. All cloned records must be inserted under the active tenant's `orgId`.
- **REQ-2.2**: If the source sequence does not exist or belongs to another tenant, a `404 Not Found` error must be returned.
- **REQ-2.3**: Complete TypeScript safety and clean compilation.
- **REQ-2.4**: Comprehensive Vitest suite asserting RLS boundaries, deep copying of steps/branches/actions/triggers/tags, and Hono routing.
