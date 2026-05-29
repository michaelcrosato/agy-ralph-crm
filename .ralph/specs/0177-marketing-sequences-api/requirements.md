# Specification: Marketing Sequences & Drip Journeys API - Requirements

## 1. Functional Requirements

### 1.1 Sequence Structure & Steps
- **REQ-1.1.1**: The system must support creating Sequences, which contain: `id` (UUID), `orgId` (UUID), `name` (text), `description` (text), and `status` (draft/active).
- **REQ-1.1.2**: A Sequence must support multiple steps (`marketing_sequence_steps`). Each step has a `stepNumber` (sequential integer starting at 1), `delayDays` (days to wait since the last step or since enrollment), and a `templateId` (referencing an `email_templates` record).
- **REQ-1.1.3**: RLS tenant isolation must govern all Sequence and Step operations.

### 1.2 Sequence Enrollment & Progress Tracking
- **REQ-1.2.1**: The system must allow enrolling Leads or Contacts into an active Sequence via a membership table (`marketing_sequence_memberships`).
- **REQ-1.2.2**: The membership record must track the recipient type (`lead` or `contact`), recipient ID, `status` (`active`, `completed`, `unsubscribed`, `error`), the `currentStepNumber` (default 0 or 1), `lastExecutedAt`, and `nextExecutionAt`.
- **REQ-1.2.3**: Upon enrollment, the system must set the initial `nextExecutionAt` as the current time plus the `delayDays` of the first step (step 1).

### 1.3 Chronological Execution Engine
- **REQ-1.3.1**: The system must provide a processing engine `executePendingSequenceSteps` that finds all `active` memberships where `nextExecutionAt` <= current time.
- **REQ-1.3.2**: For each pending membership, the engine must:
  - Verify GDPR / channel email consent. If the recipient's consent preference status is `opt_out`, mark the membership `unsubscribed` and skip dispatch.
  - Fetch the corresponding step and its email HTML template.
  - Compile the email template, replacing dynamic placeholders (such as `{{firstName}}`, `{{lastName}}`, `{{company}}`).
  - Create a new outbound `activity` record (type: `email`, subject from template/compiled, body compiled) linked to the Lead/Contact via `activity_links`.
  - Update `currentStepNumber` (increment by 1).
  - If there are subsequent steps, calculate the new `nextExecutionAt` (adding the next step's `delayDays` to current time) and set membership status `active`.
  - If no more steps exist, set status `completed`.
- **REQ-1.3.3**: RLS tenant boundaries must be fully preserved during execution context processing.

### 1.4 REST API Endpoints
- **REQ-1.4.1**: `POST /api/sequences` - Create a marketing sequence.
- **REQ-1.4.2**: `POST /api/sequences/:id/steps` - Append step configurations to the sequence.
- **REQ-1.4.3**: `POST /api/sequences/:id/enroll` - Enroll Lead or Contact into a sequence.
- **REQ-1.4.4**: `POST /api/sequences/execute` - Manually trigger cron execution processing.
- **REQ-1.4.5**: `GET /api/sequences/:id/members` - Retrieve progress and tracking log of enrolled members.

## 2. Technical & Security Requirements
- **REQ-2.1**: Complete tenant RLS isolation: a tenant must never see, enroll members into, execute steps of, or query memberships of another tenant's sequences.
- **REQ-2.2**: TypeScript monorepo must compile cleanly without any compilation or type check errors.
- **REQ-2.3**: Biome linter checks must pass cleanly without warning or error reports.
