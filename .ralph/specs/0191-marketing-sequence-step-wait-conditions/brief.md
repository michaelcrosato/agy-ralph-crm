# Specification: Marketing Sequence Step Wait Conditions - Brief

## 1. Functional Objective
In sophisticated marketing automation systems (such as HubSpot or Marketo), sequence steps are not always sent after a simple, static number of delay days. Marketers need the ability to define **Wait Conditions** to ensure emails are sent at the optimal moments to maximize engagement:
1. **Day of Week & Time of Day Restrictions**: For example, wait until a Monday, Wednesday, or Friday at 09:00 AM before sending the next onboarding email.
2. **Behavioral or State Wait Conditions**: While static delays are useful, wait conditions that align with the recipient's local calendar or specific business days increase click-through and open rates.

This specification introduces **Task 0191: Marketing Sequence Step Wait Conditions**. It extends the sequence steps database schema and execution engine to support advanced wait rules, allowing dynamic calculation of the next step execution time.

## 2. Technical Scope
- **Database Schema Upgrades**:
  - Update `marketingSequenceSteps` table under `packages/db` to support a `waitCondition` JSONB field.
  - Update corresponding TypeScript interfaces and mock databases inside `packages/db`.
- **Core Execution Engine Upgrades**:
  - Update the `executePendingSequenceSteps` loop in `packages/core` to evaluate the step's `waitCondition`.
  - Implement a wait condition solver that calculates the exact next execution date/time based on the rule (e.g. "Monday at 09:00").
  - Maintain backwards compatibility: if no wait condition is defined, fall back to the standard `delayDays` calculation.
- **API and REST Gateways**:
  - Update Hono API sequence step creation/update endpoints in `apps/api` to serialize and validate `waitCondition` payloads.
- **Verification and RLS Tests**:
  - Write robust integration and RLS tests inside `packages/testing/src/marketing-sequence-wait-conditions.test.ts` to assert correct date calculation, tenant separation, and audit logs.
