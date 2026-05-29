# Specification: Marketing Sequence Daily Sending Throttle Limit - Brief

## 1. Functional Objective
In enterprise-grade marketing platforms, organizations need to control and throttle their email dispatch volumes to prevent spam filter triggers, maintain domain health, and comply with daily sending limits.
This task introduces **Task 0192: Marketing Sequence Daily Sending Throttle Limit**. It adds the ability for users to specify a maximum daily send volume for a marketing sequence. When the limit of sent emails for a sequence is hit in a calendar day, the scheduler suspends sending subsequent emails for that sequence, deferring them to the next day.

## 2. Technical Scope
- **Database Schema Upgrades**:
  - Update `marketingSequences` table under `packages/db` to support a `dailySendLimit` integer field.
  - Update corresponding TypeScript interfaces and mock databases inside `packages/db`.
- **Core Execution Engine Upgrades**:
  - Update `executePendingSequenceSteps` loop in `packages/core` to evaluate the current day's executed emails for each sequence.
  - If a sequence has a daily send limit configured, count its successful executions on the current calendar day (using `lastExecutedAt` of memberships matching the current date).
  - Defer memberships that would exceed the daily send limit by pushing their `nextExecutionAt` by 24 hours and creating a `membership_schedule_deferred` or `membership_throttled` audit log.
- **API and REST Gateways**:
  - Update Hono API sequence endpoints in `apps/api` (both `POST /api/sequences` and `POST /api/sequences/:id/schedule`) to serialize and validate `dailySendLimit` payloads.
- **Verification and RLS Tests**:
  - Write robust integration and RLS tests inside `packages/testing/src/marketing-sequence-throttle.test.ts` to assert correct count calculation, tenant isolation, deferral, and audit logs.
