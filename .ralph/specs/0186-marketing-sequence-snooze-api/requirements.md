# Specification: Marketing Sequence Member Snooze & Resume Engine - Requirements

## 1. Functional Requirements

### 1.1 DB Column & State Configuration
- The `marketing_sequence_memberships` table must support new nullable columns:
  - `snoozeUntil`: A timestamp representing when a snooze period ends.
  - `snoozeReason`: A text column describing why the membership was snoozed.
- The membership `status` field supports the `"snoozed"` state.
- When `status === "snoozed"`:
  - Background step execution must skip this membership (until it is resumed).

### 1.2 Explicit Snoozing & Resuming
- Users must be able to explicitly pause (snooze) any `"active"` sequence membership:
  - Input: `snoozeUntil` (ISO string/timestamp) and an optional `snoozeReason`.
  - Effect: Status transitions to `"snoozed"`, `snoozeUntil` is populated, and an audit trail log is generated with action `"membership_snoozed"`.
- Users must be able to explicitly resume any `"snoozed"` sequence membership:
  - Effect: Status transitions back to `"active"`, `snoozeUntil` and `snoozeReason` are set to `null`, `nextExecutionAt` is updated to the current time, and an audit trail log with action `"membership_resumed"` is created.

### 1.3 Automatic Resumption Flow in Background Scheduler
- When the background step execution loop (`executePendingSequenceSteps`) runs:
  - The engine must find all memberships under the current tenant with status `"snoozed"` where `snoozeUntil <= currentTime`.
  - For each eligible membership:
    1. Update status to `"active"`.
    2. Reset `snoozeUntil` to `null`.
    3. Update `nextExecutionAt` to `currentTime` (or the scheduler's current time).
    4. Write a `"membership_resumed"` audit trail log showing the status transition and snooze removal.
  - After processing auto-resumptions, the background loop continues normally, executing steps for all `"active"` memberships (including the newly reactivated ones if their `nextExecutionAt` makes them eligible!).

### 1.4 Tenant RLS Isolation
- Memberships are strictly bound to their parent organization (`orgId`).
- An API request to snooze or resume a membership in Tenant A from a Tenant B session context must throw a strict 404/403 or RLS Violation.
- Automatic background worker resumptions must respect RLS contexts or process only within active organization context boundaries.

---

## 2. API Endpoints

### 2.1 POST `/api/sequences/memberships/:membershipId/snooze`
- Snoozes a sequence membership.
- Payload:
  ```json
  {
    "snoozeUntil": "2026-06-05T12:00:00.000Z",
    "reason": "Sales rep manual outreach"
  }
  ```
- Returns `200 OK` with the updated membership.
- If the membership does not exist or belongs to another tenant, return `404 Not Found`.

### 2.2 POST `/api/sequences/memberships/:membershipId/resume`
- Explicitly resumes a sequence membership.
- Payload: *None*
- Returns `200 OK` with the updated membership.
- If the membership does not exist or belongs to another tenant, return `404 Not Found`.
