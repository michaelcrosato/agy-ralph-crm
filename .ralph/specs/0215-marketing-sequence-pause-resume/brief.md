# Specification: Marketing Sequence Pause & Resume API - Brief

## 1. Functional Objective
This feature introduces sequence-level pause and resume capabilities to the Marketing Automation module (Task 0215). Pausing a sequence is critical when marketing campaigns need to be suspended globally (e.g. during emergency branding updates, server outages, or unexpected seasonal pauses) without requiring users to pause every individual contact or lead membership manually.

The system will allow users to:
1. **Pause a sequence**: Transitions a sequence `status` from `"active"` to `"paused"`.
2. **Resume a sequence**: Transitions a sequence `status` from `"paused"` back to `"active"`.
3. **Execution bypass**: When a sequence is `"paused"`, the step execution engine (`executePendingSequenceSteps`) will bypass processing steps for all of its memberships.

## 2. Technical Scope
- **Tenancy Isolation**: Pausing and resuming sequences must run under strict tenant context checks.
- **Pure Core Logic**: Core methods `pauseMarketingSequence(dbStore, sequenceId, orgId)` and `resumeMarketingSequence(dbStore, sequenceId, orgId)` in `packages/core/src/index.ts` will validate tenant ownership and transition sequence status.
- **REST Endpoints**:
  - `POST /api/sequences/:id/pause` - Pauses an active sequence.
  - `POST /api/sequences/:id/resume` - Resumes a paused sequence.
- **Verification**: Complete unit and integration test coverage validating tenant RLS, state transitions, execution bypass in the runner, and API contract validations.
