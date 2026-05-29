# Specification: Marketing Sequence Daily Sending Throttle Limit - Requirements

## 1. Functional Requirements

### 1.1 Sequence Daily Sending Limit Configuration
- Each marketing sequence (`marketingSequences` table) MUST support an optional integer field named `dailySendLimit`.
- The `dailySendLimit` MUST be validated to be a positive integer or null when creating or updating sequences via the API.
- If `dailySendLimit` is null or undefined, no sending limit throttle is applied.

### 1.2 Throttle Evaluation during Execution
- During `executePendingSequenceSteps` loop:
  - The engine MUST query all sequence memberships to determine the number of emails already successfully executed for the sequence on the current calendar day (in the system local timezone).
  - A membership's step is considered successfully executed on the current calendar day if `lastExecutedAt` matches `currentTime`'s year, month, and day.
  - The engine MUST keep track of the cumulative executions (including those executed within the current execution batch) to compare against the limit.
  - If a sequence has hit or would exceed its `dailySendLimit` for the current calendar day, subsequent eligible pending memberships for that sequence MUST NOT execute.
  - Instead, the engine MUST defer their execution by setting `nextExecutionAt` to exactly 24 hours in the future (i.e. `currentTime + 24 hours`).
  - An audit log MUST be generated for each deferred membership with action `membership_schedule_deferred` (or `membership_throttled`), logging the limit breach.

### 1.3 REST API Validation
- Sequence creation (`POST /api/sequences`) and schedule updates (`POST /api/sequences/:id/schedule`) MUST accept, serialize, and validate `dailySendLimit`.
- Invalid limits (such as non-integers, negative numbers, or strings that cannot be parsed as positive integers) MUST return `400 Bad Request`.

---

## 2. Row-Level Security (RLS) & Tenancy Requirements
- All database operations for daily send limits, sequence execution counts, and membership audits MUST be strictly isolated under active tenant row-level security.
- One tenant organization MUST NOT be able to view, query, modify, or trigger throttle limits belonging to another organization.
