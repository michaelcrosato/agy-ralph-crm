# Specification: Marketing Sequence Webhook Actions - Requirements

## 1. Functional Requirements

### 1.1 Webhook Sequence Steps Creation
- **REQ-1.1.1**: The system must allow creating sequence steps of type `webhook`.
- **REQ-1.1.2**: A Webhook step must support:
  - `stepType`: "webhook" (defaults to "email")
  - `webhookUrl`: A valid HTTP/HTTPS URL string
  - `webhookPayload`: An optional string containing a custom JSON/text payload template
- **REQ-1.1.3**: When creating a `webhook` step, the `templateId` parameter must be optional and can be `null`.
- **REQ-1.1.4**: Standard step parameters such as `stepNumber`, `delayDays`, and `waitCondition` must be fully supported on webhook steps.

### 1.2 Webhook Step Execution
- **REQ-1.2.1**: When `executePendingSequenceSteps` runs, if a step is of type `webhook`, the system must skip email sending / template loading and instead enqueue a delivery item in the outbound `webhookOutbox` queue.
- **REQ-1.2.2**: The enqueued outbox payload should default to a structured JSON payload containing `sequenceId`, `membershipId`, `stepNumber`, `recordType`, `recordId`, and recipient metadata, unless a custom `webhookPayload` template is configured.
- **REQ-1.2.3**: After enqueuing, the sequence membership status and step advancement logic must behave identically to email steps, updating `currentStepNumber` and setting `nextExecutionAt` based on delay days.

## 2. Security & Verification Requirements
- **REQ-2.1**: Strict tenant RLS: a tenant must never be allowed to create sequence steps or trigger webhook actions belonging to another organization.
- **REQ-2.2**: Complete TypeScript compilation with zero errors.
- **REQ-2.3**: Integration test coverage asserting webhook outbox enqueuing, step execution, and tenant RLS isolation.
