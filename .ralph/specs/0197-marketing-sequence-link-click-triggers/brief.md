# Specification: Marketing Sequence Link Click Triggers - Brief

## 1. Functional Objective
To enable interactive and responsive marketing campaigns, enterprise users need the ability to trigger automated business actions when a recipient (Lead or Contact) clicks on a specific link (or any link) inside an email sent by a marketing sequence step.
This feature introduces **Task 0197: Marketing Sequence Email Link Click-Through Action Triggers**.

When a tracking click event is registered for a sequence email, the system will:
1. Resolve the sequence step and membership associated with the email activity.
2. Identify any link action rules configured for that step.
3. If the clicked URL matches a configured link action (either matching exactly or matching a wildcard `*`), execute the configured action:
   - **Field Update (`field_update`)**: Automatically update a specific field on the Lead or Contact record (e.g. updating Lead Status to "Qualified", or a custom field).
   - **Create Task (`create_task`)**: Automatically create a new CRM Task associated with the recipient (e.g. creating a follow-up task for the owner due in 2 days).
4. Create an immutable audit log entry documenting the trigger execution and changes made.

## 2. Technical Scope
- **Database Schema**:
  - Implement a new table `marketingSequenceLinkActions` (`marketing_sequence_link_actions`) in `schema.ts` and `index.ts` under `packages/db`.
- **Core Processor Engine**:
  - Implement a link click triggers processor in `packages/core/src/index.ts` to evaluate and execute the actions for a sequence membership and step when a link click event occurs.
- **API Gateways**:
  - Expose API endpoints `/api/sequences/steps/:id/link-actions` to create, read, and delete link actions.
  - Update the public click tracking endpoint `/api/public/emails/track/click/:token` to invoke the link click triggers processor when a click occurs.
- **Verification and RLS Isolation**:
  - Ensure strict tenant RLS isolation: link actions, recipient records, and trigger executions must never leak across organizations.
  - Write robust integration tests in `packages/testing/src/marketing-sequence-link-triggers.test.ts`.
