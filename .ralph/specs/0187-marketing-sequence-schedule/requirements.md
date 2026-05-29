# Specification: Marketing Sequence Sending Schedule & Deferral Engine - Requirements

## 1. Functional Requirements

### 1.1 DB Fields & Sequence Configuration
- The `marketing_sequences` table must support three new nullable fields:
  - `sendingWindowStart`: A string representation of daily start time in `"HH:MM"` format (e.g. `"09:00"`).
  - `sendingWindowEnd`: A string representation of daily end time in `"HH:MM"` format (e.g. `"17:00"`).
  - `sendingDays`: A JSON array of numbers representing ISO days of the week (1 = Monday, 7 = Sunday).
- If any of these fields are `null`, the schedule restriction is considered disabled (the sequence will send at any time or day, as standard).

### 1.2 Deferral Evaluation in Background Worker
- During the sequence step execution worker loop (`executePendingSequenceSteps`):
  - For each pending active membership where `nextExecutionAt <= currentTime`:
    - Fetch its associated sequence.
    - If the sequence has `sendingDays` or a sending window configured:
      - Evaluate whether `currentTime` is within the allowed days and allowed hour window.
      - Hour window bounds are inclusive on start time and exclusive on end time (e.g., `"09:00"` to `"17:00"` allows execution from `09:00:00` up to `16:59:59`).
      - If `currentTime` is outside the allowed schedule:
        1. Calculate the next valid sending time slot.
           - If it is currently outside the hour window but on an allowed day:
             - If it is before `sendingWindowStart`, defer to today at `sendingWindowStart`.
             - If it is after `sendingWindowEnd`, defer to the next allowed day at `sendingWindowStart`.
           - If it is on a disallowed day, defer to the next allowed day at `sendingWindowStart`.
        2. Update the membership's `nextExecutionAt` in the database to this calculated future time.
        3. Write a `"membership_schedule_deferred"` audit log entry with detailed changes.
        4. Skip executing any sequence steps for this membership in the current evaluation run.

### 1.3 Tenant RLS Isolation
- Sequences and their memberships are strictly bound to their organization (`orgId`).
- An API request to modify the sending schedule of a sequence in Tenant A from a Tenant B session context must throw a 404 Not Found or throw an RLS Isolation Violation.

---

## 2. API Endpoints

### 2.1 POST `/api/sequences/:id/schedule`
- Updates the sending schedule of a marketing sequence.
- Payload:
  ```json
  {
    "sendingWindowStart": "09:00",
    "sendingWindowEnd": "17:00",
    "sendingDays": [1, 2, 3, 4, 5]
  }
  ```
- Validation rules:
  - `sendingWindowStart` and `sendingWindowEnd` must be in `"HH:MM"` format if provided, or `null`.
  - `sendingDays` must be an array of integers between 1 and 7, or `null`.
- Returns `200 OK` with the updated sequence data.
- If the sequence does not exist or belongs to another tenant, return `404 Not Found`.
