# Specification: Marketing Sequences & Drip Journeys API - Brief

## 1. Functional Objective
This feature introduces automated **Marketing Sequences & Drip Journeys**. It allows organizations to orchestrate multi-step automated email follow-up/nurture flows (drip campaigns) for Leads and Contacts.
It implements:
1. **Drip Flow Scaffolding**: Allowing marketing/sales operations to create a Sequence and add progressive steps with specific wait times (delay days) and personalized email templates.
2. **Automated Sequence Enrollment**: Support enrolling Leads or Contacts into a Sequence, which registers their starting progress and computes their chronological dispatch schedule.
3. **Sequence Execution Engine**: A cron-like execution handler that scans for active memberships ready for their next step, personalizes the specified email template (resolving Lead/Contact merge fields), generates outbound email activities, and computes their subsequent wait delay.
4. **GDPR / Unsubscribe Compliance Check**: The execution engine strictly checks if a recipient has opted out of email communications before dispatching, avoiding non-compliant follow-ups.
5. **RLS tenant isolation**: Every sequence, step, enrollment, and outbound activity is strictly isolated at the tenant organization level.

## 2. Technical Scope
- **Database Schema Expansion**:
  - Add tables `marketing_sequences`, `marketing_sequence_steps`, and `marketing_sequence_memberships` in `packages/db`.
- **Core Engine Mechanics**:
  - Implement a `packages/core` helper `enrollInSequence(sequenceId, recordType, recordId)` and `executePendingSequenceSteps()`.
- **REST Endpoints**:
  - `POST /api/sequences` - Create a marketing sequence.
  - `POST /api/sequences/:id/steps` - Add step configurations.
  - `POST /api/sequences/:id/enroll` - Enroll Lead/Contact.
  - `POST /api/sequences/execute` - Process active drip stages.
  - `GET /api/sequences/:id/members` - Retrieve status and progress.
- **Verification Gate**:
  - Workspace compilation (`pnpm verify`), and comprehensive RLS/integration test suites in `packages/testing/src/marketing-sequences.test.ts`.
