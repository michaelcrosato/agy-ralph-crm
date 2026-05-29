# Specification: Marketing Sequence Recipient Time-Zone Smart Delivery Engine - Brief

## 1. Functional Objective
In enterprise marketing automation, outbound communications (like drip campaign emails) must be delivered at optimal hours relative to the recipient's local time (e.g., between 9:00 AM and 5:00 PM in their local timezone). Sending emails at inappropriate hours (e.g., 2:00 AM local time) decreases open rates, increases spam complaints, and degrades customer experience.

This specification introduces **Task 0189: Marketing Sequence Recipient Time-Zone Smart Delivery Engine**. 
It updates the sequence execution scheduling logic to look up the recipient's timezone (stored in Lead or Contact custom metadata under `custom.timezone`) and defer sequence execution until the next allowed time-window in the recipient's local timezone.

## 2. Technical Scope
- **Domain Logic Extension**:
  - Extend the `getNextValidSendingTime` utility in `packages/core/src/index.ts` to accept an optional `timezone` argument.
  - Implement dynamic local time and timezone offset calculations using standard, platform-independent Node.js `Intl.DateTimeFormat` APIs.
  - Safely parse the recipient's timezone from Lead/Contact custom metadata `custom.timezone` (defaulting to `"UTC"` if absent or unrecognized).
- **Core Engine Integration**:
  - Update `executePendingSequenceSteps` in `packages/core` to resolve the recipient profile (Lead or Contact) and retrieve their timezone before calculating the next valid execution schedule.
  - When scheduling the next step of a membership, calculate the new `nextExecutionAt` date based on the recipient's local timezone constraints.
- **REST Endpoints & Testing**:
  - Integrate with the Hono sequence execution and lead/contact registration routing checks.
  - Write high-coverage integration and RLS tests under `packages/testing/src/marketing-sequence-timezone.test.ts`.
