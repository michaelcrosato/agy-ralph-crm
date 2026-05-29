# Specification: Marketing Sequence Sending Schedule & Deferral Engine - Brief

## 1. Functional Objective
In marketing automation and drip email campaigns, sending emails at inappropriate times (such as midnight, weekends, or holidays) can severely damage sender reputation, increase spam complaints, and lead to poor open rates. B2B marketing sequences should only communicate during business days and normal business hours.

This feature introduces the **Marketing Sequence Sending Schedule & Deferral Engine** (Task 0187).
It allows marketing managers to restrict step executions for a marketing sequence:
1. **Allowed Sending Days**: Select which days of the week (e.g., Monday through Friday) a sequence is allowed to dispatch emails.
2. **Allowed Sending Window**: Define a daily time window (e.g., between 09:00 and 17:00) during which emails can be sent.

If a sequence membership is due for execution (i.e. `nextExecutionAt <= currentTime`), but the current time falls outside the allowed sending days or hours:
- The engine calculates the **next allowed sending slot** (e.g., the start of the next business day's sending window).
- The membership's `nextExecutionAt` is deferred to that next valid slot.
- A `"membership_schedule_deferred"` audit log is created.
- The step execution is bypassed for the current cycle.

## 2. Technical Scope
- **Database Schema**:
  - Add `sendingWindowStart` (text, e.g. `"09:00"`), `sendingWindowEnd` (text, e.g. `"17:00"`), and `sendingDays` (jsonb array of integers, e.g., `[1, 2, 3, 4, 5]`) to the `marketing_sequences` table in `packages/db/src/schema.ts`.
- **Core Engine Integration**:
  - Update `DBMarketingSequence` interface in `packages/db`.
  - Implement a date calculation helper `getNextValidSendingTime` in `packages/core`.
  - Update `executePendingSequenceSteps` in `packages/core` to check for sending schedules. If the evaluation time falls outside the schedule, defer the membership's `nextExecutionAt` and bypass the current step execution.
- **REST Endpoints**:
  - `POST /api/sequences/:id/schedule` - Updates the sending days and sending window for a marketing sequence.
- **Verification**:
  - Write integration tests in `packages/testing/src/marketing-sequence-schedule.test.ts` to assert that scheduling deferrals work flawlessly, correct next execution times are calculated, and RLS tenant isolation is preserved.
