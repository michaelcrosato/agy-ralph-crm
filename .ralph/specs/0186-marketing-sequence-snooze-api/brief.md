# Specification: Marketing Sequence Member Snooze & Resume Engine - Brief

## 1. Functional Objective
In marketing automation, there are frequent scenarios where a lead or contact needs to be temporarily paused (snoozed) from receiving automated sequence drip communications. Some key use cases include:
- A salesperson engaging in a high-intensity, manual sales conversation with a prospect, wanting to temporarily halt generic drip emails.
- A client requesting to snooze marketing communications during holidays or busy seasons without completely unsubscribing.
- System-level pauses (e.g., when a related support ticket is opened, or during a customer trial phase).

This feature introduces the **Marketing Sequence Member Snooze & Resume Engine** (Task 0186).
It allows marketing managers and sales representatives to:
1. **Snooze a membership**: Set a membership status to `"snoozed"` and define a `snoozeUntil` datetime (and optional `snoozeReason`), temporarily preventing any sequence steps from executing.
2. **Resume a membership**: Explicitly reactivate a membership back to `"active"` status (setting `snoozeUntil` to `null` and resetting `nextExecutionAt` to the current time so it executes on the next cycle).
3. **Auto-resume via background worker**: The step execution worker (`executePendingSequenceSteps`) automatically checks for any memberships whose snooze time has passed (`snoozeUntil <= currentTime`), reactivates them, logs audit trails, and executes any pending steps.

## 2. Technical Scope
- **Database Schema**:
  - Add `snoozeUntil` (timestamp) and `snoozeReason` (text) columns to the `marketing_sequence_memberships` table in `packages/db/src/schema.ts`.
- **Core Engine Integration**:
  - Update `CoreSequenceMembership` and `DBMarketingSequenceMembership` interfaces.
  - Implement auto-resumption processing at the start of `executePendingSequenceSteps` inside `packages/core/src/index.ts`. Any `"snoozed"` membership whose `snoozeUntil` date is in the past will transition back to `"active"` with `nextExecutionAt` reset to the execution time, writing standard `"membership_resumed"` audit logs.
- **REST Endpoints**:
  - `POST /api/sequences/memberships/:membershipId/snooze` - Snoozes a sequence membership, setting a date and optional reason.
  - `POST /api/sequences/memberships/:membershipId/resume` - Explicitly resumes a sequence membership, reactivating it immediately.
- **Verification**:
  - Integration tests in `packages/testing/src/marketing-sequence-snooze.test.ts` validating pausing, resuming, RLS tenant isolation, automatic background worker resumption, and audit logs.
