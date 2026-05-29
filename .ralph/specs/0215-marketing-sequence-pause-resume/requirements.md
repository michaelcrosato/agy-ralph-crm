# Specification: Marketing Sequence Pause & Resume API - Requirements

## 1. Functional Requirements

### 1.1 Sequence Pause & Resume Status
- **REQ-1.1.1**: The system must allow changing a marketing sequence's status to `"paused"` via the core function `pauseMarketingSequence(dbStore, sequenceId, orgId)`.
- **REQ-1.1.2**: Pausing a sequence is only allowed if the sequence is currently `"active"`. Trying to pause a `"draft"` or `"archived"` sequence must throw an explicit error: `"Only active sequences can be paused"`.
- **REQ-1.1.3**: The system must allow resuming a paused marketing sequence back to `"active"` via the core function `resumeMarketingSequence(dbStore, sequenceId, orgId)`.
- **REQ-1.1.4**: Resuming a sequence is only allowed if the sequence is currently `"paused"`. Trying to resume a `"draft"`, `"active"`, or `"archived"` sequence must throw an explicit error: `"Only paused sequences can be resumed"`.

### 1.2 Execution Engine Bypass
- **REQ-1.2.1**: The background sequence execution engine (`executePendingSequenceSteps`) must query the sequence for each membership it processes.
- **REQ-1.2.2**: If the sequence status is `"paused"`, the engine must skip processing steps for the membership in the current execution cycle.
- **REQ-1.2.3**: Skipping execution for a paused sequence must NOT change the membership's `nextExecutionAt` or status, so it remains eligible to execute immediately once the sequence is resumed.

### 1.3 REST API Endpoints
- **REQ-1.3.1**: `POST /api/sequences/:id/pause` - Pauses an active sequence. Returns success status and the updated sequence.
- **REQ-1.3.2**: `POST /api/sequences/:id/resume` - Resumes a paused sequence. Returns success status and the updated sequence.

## 2. Security & Verification Requirements
- **REQ-2.1**: Tenant RLS: A tenant must NEVER be allowed to pause, resume, or query another organization's sequence. All operations must run under active `orgId` verification.
- **REQ-2.2**: If the target sequence does not exist or belongs to another tenant, the API must return `404 Not Found`.
- **REQ-2.3**: Complete TypeScript compilation safety with zero warnings or type errors.
- **REQ-2.4**: Comprehensive Vitest suite asserting RLS, status transitions, execution bypass in the runner, and Hono route correctness.
