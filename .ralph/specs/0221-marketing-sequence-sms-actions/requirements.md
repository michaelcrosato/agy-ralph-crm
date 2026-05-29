# Specification: Marketing Sequence SMS Actions - Requirements

## 1. Functional Requirements

### 1.1 Step Creation & Configuration
- Users must be able to add SMS steps to any existing marketing sequence.
- An SMS step requires specifying:
  - `stepNumber`: The sequential order of the step.
  - `delayDays`: The number of days to wait before executing this step.
  - `stepType`: Must be `"sms"`.
  - `smsMessage`: The text message template (required).
- Input validation must reject requests if `smsMessage` is missing, empty, or not a string.

### 1.2 Personalization & Dynamic Formatting
- The message template must support dynamic merge tags matching lead/contact attributes (e.g. `{{lead.firstName}}`, `{{contact.lastName}}`, `{{lead.company}}`, etc.).
- Personalization must process templates safely, falling back to empty strings or raw placeholders if a field does not exist.

### 1.3 Automated Execution & Activity Tracking
- The core marketing sequence execution engine (`executePendingSequenceSteps`) must correctly process steps of type `"sms"`.
- When an SMS step is executed:
  - The message must be personalized for the recipient.
  - An activity record of type `"sms"` must be inserted into the `activities` store.
  - An activity link must be inserted into `activityLinks` connecting the SMS activity to the Lead or Contact.
  - The sequence membership must advance to the next step or mark the membership as `completed`.
  - An audit log entry must be created recording the execution of the SMS step.

## 2. Security & Tenancy Isolation (RLS)
- **RLS Boundary**: A tenant cannot create or append steps to a sequence belonging to another tenant org.
- **Tenant Scope Enforcement**: During the automated cron execution of sequences, all generated activity records, activity link records, and membership updates must reside strictly under the correct active tenant's `orgId`.
- **Query Leak Protection**: A tenant cannot view, search, or query SMS activities or links belonging to another tenant.
