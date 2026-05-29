# Specification: Marketing Sequence Call Actions - Brief

## 1. Functional Objective
This feature introduces automated outbound Call actions to marketing sequences (Task 0222). Similar to how sequence steps deliver automated emails, trigger webhooks, create tasks, or send SMS, users can now add custom Call actions. When a recipient reaches a Call sequence step, the system will personalize the call script using recipient personalization tags (e.g. `{{lead.firstName}}`, `{{contact.lastName}}`, etc.) and log an outbound Call activity (`activities` table of type `"call"`) linked directly to the recipient record under strict active tenant Row-Level Security (RLS) isolation.

## 2. Technical Scope
- **Tenancy Isolation**: Call sequence step configuration, delivery activities, and target links must be securely contained within the active tenant's organization context.
- **REST Endpoints**:
  - `POST /api/sequences/:id/steps` - Add support for `stepType: "call"` with input validation requiring a non-empty `callScript`.
- **Pure Core Logic**:
  - Extend `executePendingSequenceSteps` to process steps of type `"call"`.
  - Perform dynamic variable personalization on the `callScript` using sequence membership recipient properties.
  - Automatically create the corresponding CRM Activity in `activities` with standard properties: `type: "call"`, `subject: "Outbound Call"`, `body: personalizedCallScript`, `dueDate: null`, `creatorId` (system user), and `orgId` matching the sequence's orgId.
  - Create the corresponding activity link in `activityLinks` to link the new Call activity directly to the recipient record (Lead or Contact).
- **Verification**: Complete integration tests asserting correct API behavior, automated personalization, activity logging, linking, and absolute RLS tenant isolation.
