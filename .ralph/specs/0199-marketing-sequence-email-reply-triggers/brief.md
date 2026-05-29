# Specification: Marketing Sequence Email Reply Triggers - Brief

## 1. Functional Objective
To enable interactive and responsive marketing campaigns, enterprise users need the ability to trigger automated business actions and update membership statuses when a recipient (Lead or Contact) replies to an email sent by a marketing sequence step.
This feature introduces **Task 0199: Marketing Sequence Email Reply Triggers**.

When a tracking reply event is registered for a sequence email, the system will:
1. Resolve the sequence step and membership associated with the email activity.
2. Automatically complete the sequence membership (transition its status to `completed`) to ensure the recipient does not receive any further automated follow-up emails once they have replied.
3. Identify any reply action rules configured for that step.
4. Execute the configured action:
   - **Field Update (`field_update`)**: Automatically update a specific field on the Lead or Contact record (e.g. updating Lead Status to "Responded", or a custom field).
   - **Create Task (`create_task`)**: Automatically create a new CRM Task associated with the recipient (e.g. creating a follow-up task for the owner to call them back).
5. Create an immutable audit log entry documenting the trigger execution, membership auto-completion, and recipient/task changes made.

## 2. Technical Scope
- **Database Schema**:
  - Implement a new table `marketingSequenceReplyActions` (`marketing_sequence_reply_actions`) in `schema.ts` and `index.ts` under `packages/db`.
  - Update `emailTrackers` to include `replyCount` and `lastRepliedAt` columns.
- **Core Processor Engine**:
  - Implement an email reply triggers processor in `packages/core/src/index.ts` to evaluate and execute the actions for a sequence membership and step when an email reply event occurs, transitioning the membership status to `completed`.
- **API Gateways**:
  - Expose API endpoints `/api/sequences/steps/:id/reply-actions` to create, read, and delete reply actions.
  - Expose a public reply tracking endpoint `/api/public/emails/track/reply/:token` to invoke the reply triggers processor when a reply occurs.
- **Verification and RLS Isolation**:
  - Ensure strict tenant RLS isolation: reply actions, recipient records, and trigger executions must never leak across organizations.
  - Write robust integration tests in `packages/testing/src/marketing-sequence-reply-triggers.test.ts`.
