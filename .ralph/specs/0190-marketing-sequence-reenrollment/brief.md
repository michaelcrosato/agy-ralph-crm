# Specification: Marketing Sequence Campaign Automated Re-Enrollment & Frequency Capping Controls - Brief

## 1. Functional Objective
In enterprise marketing automation platforms (like HubSpot, Marketo, or Salesforce Marketing Cloud), orchestrating repeat engagements and safeguarding customer experience are foundational capabilities:
1. **Re-Enrollment Rules**: Determine whether a recipient (Lead or Contact) can enter the same drip campaign sequence multiple times. For example, a customer signing up for a weekly webinar should be allowed to enter the onboarding/webinar sequence again, whereas a general prospecting sequence should strictly bar re-entry.
2. **Frequency Capping**: Even when re-enrollment is allowed, recipients should not be bombarded with duplicate touchpoints too closely together. A minimum cooldown period (e.g., 30 days) must be enforced between sequence engagements to prevent spam complaints, opt-outs, and domain reputation damage.
3. **Active Enrollment Protection**: A recipient must never be enrolled in the same sequence multiple times concurrently, as this would result in duplicate email sends and corrupted tracking metrics.

This specification introduces **Task 0190: Marketing Sequence Campaign Automated Re-Enrollment & Frequency Capping Controls**. It implements automated checks inside the sequence enrollment engine and exposes REST API parameters to control these rules under active tenant row-level security (RLS).

## 2. Technical Scope
- **Database Schema Upgrades**:
  - Update `marketingSequences` table to support `allowReenrollment` (boolean) and `reenrollmentMinDays` (integer) columns.
  - Update corresponding TypeScript interfaces and mock databases inside `packages/db`.
- **Core Enrollment Engine Enforcement**:
  - Extend the `enrollInSequence` utility inside `packages/core` to validate incoming enrollments.
  - Block enrollment if there is an active/snoozed membership.
  - Block enrollment if there is any history of enrollment and `allowReenrollment` is false.
  - Block enrollment if the recipient was enrolled too recently according to `reenrollmentMinDays`.
- **API and REST Gateways**:
  - Update sequence creation and update endpoints in `apps/api` to accept and serialize the new controls.
  - Wrap the `/enroll` endpoint in proper error handling to return clean `400 Bad Request` validation error payloads.
- **Verification and RLS Tests**:
  - Write robust integration and property-based tenant RLS tests inside `packages/testing/src/marketing-sequence-reenrollment.test.ts`.
