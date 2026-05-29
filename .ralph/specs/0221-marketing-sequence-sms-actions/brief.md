# Specification: Marketing Sequence SMS Actions - Brief

## 1. Functional Objective
This feature introduces automated outbound SMS actions to marketing sequences (Task 0221). Similar to how sequence steps deliver automated emails, trigger webhooks, or create tasks, users can now add custom SMS actions. When a recipient reaches an SMS sequence step, the system will personalize the SMS message using recipient personalization tags (e.g. `{{lead.firstName}}`, `{{contact.lastName}}`, etc.) and log an outbound SMS activity (`activities` table of type `"sms"`) linked directly to the recipient record under strict active tenant Row-Level Security (RLS) isolation.

## 2. Technical Scope
- **Tenancy Isolation**: SMS sequence step configuration, delivery activities, and target links must be securely contained within the active tenant's organization context.
- **REST Endpoints**:
  - `POST /api/sequences/:id/steps` - Add support for `stepType: "sms"` with input validation requiring a non-empty `smsMessage`.
- **Pure Core Logic**:
  - Extend `executePendingSequenceSteps` to process steps of type `"sms"`.
  - Perform dynamic variable personalization on the `smsMessage` using sequence membership recipient properties.
  - Automatically create the corresponding CRM Activity in `activities` with standard properties: `type: "sms"`, `subject: "Outbound SMS"`, `body: personalizedSmsMessage`, `dueDate: null`, `creatorId` (system user), and `orgId` matching the sequence's orgId.
  - Create the corresponding activity link in `activityLinks` to link the new SMS activity directly to the recipient record (Lead or Contact).
- **Verification**: Complete integration tests asserting correct API behavior, automated personalization, activity logging, linking, and absolute RLS tenant isolation.
