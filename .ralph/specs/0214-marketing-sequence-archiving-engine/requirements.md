# Specification: Marketing Sequence Archiving & Deletion Engine - Requirements

## 1. Functional Requirements

### 1.1 Marketing Sequence Archiving
- **REQ-1.1.1**: The system must support archiving an existing marketing sequence via the core function `archiveMarketingSequence(dbStore, sequenceId, orgId)`.
- **REQ-1.1.2**: When archived, the sequence's `status` must be set to `"archived"`.
- **REQ-1.1.3**: The archive operation must find all memberships (`marketing_sequence_memberships`) associated with the sequence.
- **REQ-1.1.4**: Any associated membership with status `"active"` or `"paused"` must be automatically updated to `"completed"`. Other statuses (e.g. `"completed"`, `"unsubscribed"`) must remain unchanged.
- **REQ-1.1.5**: The system must block new enrollments via `enrollInSequence` for any sequence that is `"archived"`, throwing an explicit error: `"Cannot enroll in an archived sequence"`.

### 1.2 Marketing Sequence Purging (Hard Deletion)
- **REQ-1.2.1**: The system must support hard-deleting (purging) a sequence via `purgeMarketingSequence(dbStore, sequenceId, orgId)`.
- **REQ-1.2.2**: A sequence can ONLY be purged if its current status is `"archived"`. If a user attempts to purge a sequence that is in `"draft"`, `"active"`, or any other state, the system must throw an error: `"Only archived sequences can be purged"`.
- **REQ-1.2.3**: Purging a sequence must perform a transaction-safe cascade delete of:
  - The root sequence record (`marketing_sequences`).
  - All sequence steps (`marketing_sequence_steps`).
  - All step branches (`marketing_sequence_step_branches`).
  - All A/B split tests (`marketing_sequence_step_split_tests`).
  - All actions (open, reply, and link click actions) associated with steps.
  - All exit triggers (`marketing_sequence_exit_triggers`).
  - All tag mappings (`marketing_sequence_tag_mappings`).
  - All recipient memberships (`marketing_sequence_memberships`).

### 1.3 REST API Endpoints
- **REQ-1.3.1**: `POST /api/sequences/:id/archive` - Archives a sequence. Returns success status and the updated sequence.
- **REQ-1.3.2**: `DELETE /api/sequences/:id/purge` - Purges an archived sequence. Returns success message.

## 2. Security & Verification Requirements
- **REQ-2.1**: Tenant RLS: A tenant must NEVER be allowed to archive, purge, or view sequences/memberships belonging to another organization. All operations must run under active `orgId` verification.
- **REQ-2.2**: If the target sequence does not exist or belongs to another tenant, the API must return `404 Not Found` (rather than a 500 or leakage).
- **REQ-2.3**: Complete TypeScript compilation safety without any warnings or type errors.
- **REQ-2.4**: Comprehensive Vitest suite asserting RLS, state transitions, membership completion, enrollment block, cascade purge, and Hono route correctness.
