# Specification: Marketing Sequence Email Open Triggers - Brief

## 1. Functional Objective
To enable interactive and responsive marketing campaigns, enterprise users need the ability to trigger automated business actions when a recipient (Lead or Contact) opens an email sent by a marketing sequence step.
This feature introduces **Task 0198: Marketing Sequence Email Open Triggers**.

When a tracking open event is registered for a sequence email, the system will:
1. Resolve the sequence step and membership associated with the email activity.
2. Identify any open action rules configured for that step.
3. Execute the configured action:
   - **Field Update (`field_update`)**: Automatically update a specific field on the Lead or Contact record (e.g. updating Lead Status to "Working", or a custom field).
   - **Create Task (`create_task`)**: Automatically create a new CRM Task associated with the recipient (e.g. creating a follow-up task for the owner due in 1 day).
4. Create an immutable audit log entry documenting the trigger execution and changes made.

## 2. Technical Scope
- **Database Schema**:
  - Implement a new table `marketingSequenceOpenActions` (`marketing_sequence_open_actions`) in `schema.ts` and `index.ts` under `packages/db`.
- **Core Processor Engine**:
  - Implement an email open triggers processor in `packages/core/src/index.ts` to evaluate and execute the actions for a sequence membership and step when an email open event occurs.
- **API Gateways**:
  - Expose API endpoints `/api/sequences/steps/:id/open-actions` to create, read, and delete open actions.
  - Update the public open tracking endpoint `/api/public/emails/track/open/:token` to invoke the open triggers processor when an open occurs.
- **Verification and RLS Isolation**:
  - Ensure strict tenant RLS isolation: open actions, recipient records, and trigger executions must never leak across organizations.
  - Write robust integration tests in `packages/testing/src/marketing-sequence-open-triggers.test.ts`.
