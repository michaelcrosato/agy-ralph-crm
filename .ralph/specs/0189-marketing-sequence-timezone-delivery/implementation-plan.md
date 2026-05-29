# Specification: Marketing Sequence Recipient Time-Zone Smart Delivery Engine - Implementation Plan

## 1. Implementation Steps

### Step 1: Upgraded Timezone Helpers in `packages/core/src/index.ts`
- Implement `getPartsInTimezone(date: Date, tz: string)` helper function.
- Update `getNextValidSendingTime` with the optional `timezone?: string | null` parameter.
- Implement timezone-aware day and hour bounds check inside the utility loop.

### Step 2: Refactor `executePendingSequenceSteps`
- Retrieve `recordType` and `recordId` from membership.
- Query lead/contact to fetch the `custom.timezone` property.
- Pass the resolved timezone string to `getNextValidSendingTime`.

### Step 3: Write Integration and RLS Tests
- Create `packages/testing/src/marketing-sequence-timezone.test.ts`.
- Set up a mock organization and user.
- Enroll a Lead with `custom: { timezone: "Asia/Tokyo" }` and another Lead with `custom: { timezone: "America/New_York" }` in a sequence.
- Assert that running sequence execution at a fixed UTC time schedules the next executions to align perfectly with the target timezones.
- Assert RLS isolation (different tenants cannot access each other's data).

### Step 4: Run Verification Pipeline
- Run `pnpm verify` to check compiler, linting, and tests.
- Address any Biome formatting or TypeScript issues.
- Git commit all spec files, implementation, and tests.
