# Specification: Marketing Sequence Webhook Actions - Brief

## 1. Functional Objective
This feature introduces automated webhook steps to marketing sequences (Task 0219). While standard sequence steps deliver automated emails, users will now be able to add custom outbound webhook steps. When a recipient processes a webhook sequence step, the system will construct an outbound webhook payload populated with sequence, step, and recipient contact/lead details and enqueue it in the outbound `webhookOutbox` system (Task 0115) for delivery with strict multi-tenant Row-Level Security (RLS) isolation.

## 2. Technical Scope
- **Tenancy Isolation**: Webhook step configurations and triggered outbound deliveries must integrate cleanly with organization scopes under tenant contexts.
- **REST Endpoints**:
  - `POST /api/sequences/:id/steps` - Expose step creation supporting `stepType: "webhook"`, `webhookUrl`, and `webhookPayload`.
- **Pure Core Logic**: Extend `executePendingSequenceSteps` to process steps of type `"webhook"`, bypassing template loading and instead generating outbox entries in `webhookOutbox`.
- **Verification**: Complete unit and integration test coverage verifying webhook step execution, outbox queuing, and absolute RLS tenant isolation.
