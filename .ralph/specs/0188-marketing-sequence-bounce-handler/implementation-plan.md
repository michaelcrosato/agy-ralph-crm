# Specification: Marketing Sequence Bounce & Spam Protection / Handling - Implementation Plan

## Step 1: Core Logic Implementation
- Locate the end of `packages/core/src/index.ts`.
- Implement `handleEmailDeliveryEvent` which:
  - Validates inputs.
  - Queries all matching Leads and Contacts in the organization matching the recipient's email address.
  - Inserts a new row in `marketing_sequence_suppressions` for the matched recipient email.
  - Updates all active and snoozed `marketing_sequence_memberships` for matching records to `"exited"`.
  - Clears out `nextExecutionAt` and `snoozeUntil` for exited memberships.
  - Inserts audit logs for all exited memberships (`"membership_exit_bounce"` or `"membership_exit_complaint"`).
  - Updates Lead/Contact `custom.email_status` to `"bounced"` or `"complained"`.

## Step 2: Hono API Routing Implementation
- Locate `apps/api/src/index.ts` right before the start server block.
- Add `POST /api/sequences/email-event` with `tenantAuth` middleware.
- Parse `email`, `event`, and `reason` from the request JSON and execute `handleEmailDeliveryEvent` with the active `dbStore`.

## Step 3: Test Implementation
- Create `packages/testing/src/marketing-sequence-bounce.test.ts`.
- Write comprehensive tests asserting:
  - Correct suppression creation.
  - Membership auto-exit for matching email.
  - Lead and Contact profile updates.
  - Audit logging.
  - Proper RLS tenant separation.

## Step 4: Verification
- Execute `pnpm verify` and `pnpm test` to ensure zero compilation or test errors.
