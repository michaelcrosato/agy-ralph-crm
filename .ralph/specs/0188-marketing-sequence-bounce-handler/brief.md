# Specification: Marketing Sequence Bounce & Spam Protection / Handling - Brief

## 1. Functional Objective
To ensure compliance with email sending best practices and maintain sender reputation, a CRM marketing platform must immediately suspend and block communications to any recipient whose email address bounces or who reports a spam complaint. 

This feature introduces the **Marketing Sequence Bounce & Spam Protection / Handling** (Task 0188).
It allows external delivery systems (or simulated email servers) to post bounce/complaint events to our API. The system then automatically:
1. Logs a suppression record in `marketing_sequence_suppressions`.
2. Marks all active and snoozed memberships for the matching email as `"exited"` with status description or audit logs.
3. Updates the custom metadata/state for matching Lead and Contact records.
4. Generates audit trail logs capturing the suppression action.

## 2. Technical Scope
- **Database Schema**:
  - Leverages the existing `marketing_sequence_suppressions` and `marketing_sequence_memberships` tables.
- **Core Engine Integration**:
  - Implement a new domain method `handleEmailDeliveryEvent(dbStore, eventDetails)` in `packages/core`.
  - The method finds matching active/snoozed sequence memberships and moves them to `"exited"`.
  - It inserts suppression records for the bounced/complained email address.
  - It writes audit logs capturing the event.
- **REST Endpoints**:
  - `POST /api/sequences/email-event` - Webhook route simulating external email provider events.
- **Verification**:
  - Write integration tests in `packages/testing/src/marketing-sequence-bounce.test.ts` to assert that:
    - Bounces and complaints are properly logged as suppressions.
    - Active sequence memberships for the recipient are exited.
    - RLS boundaries are enforced so one tenant cannot process or query another tenant's suppressions/memberships.
