# Specification: Outbox Pattern Webhooks & Dead Letter Queue (DLQ) - Brief

## 1. Functional Objective
This feature introduces high reliability and fault tolerance to outbound REST webhooks. Rather than executing HTTP requests in an uncontrolled fire-and-forget asynchronous context, webhooks will be written into an `webhook_outbox` table under strict Row-Level Security (RLS) isolation. An automated worker (or helper functions) will process pending dispatches, implement exponential backoff retry logic, and automatically transition repeatedly failing webhooks (exceeding 5 delivery attempts) into a Dead Letter Queue (`webhook_dlq`) while logging system audit trails.

## 2. Technical Scope
- **Tenancy Isolation**: The `webhook_outbox` and `webhook_dlq` stores must integrate fully with the tenant context and AsyncLocalStorage RLS context.
- **Outbox Store & Schema**: Implement pgTables and corresponding memory stores for both outbox queue and DLQ.
- **Delivery Reliability**:
  - Outbox processing will retry failed dispatches.
  - Implement an exponential backoff formula (e.g. `nextAttemptAt = now + (2^attempts) seconds`).
  - Move webhooks that fail after 5 attempts to a Dead Letter Queue (`webhook_dlq`).
- **REST Endpoints**:
  - `POST /api/webhooks/process-outbox` - Trigger manual outbox execution and processing.
  - `GET /api/webhooks/outbox` - Retrieve outbox messages under active tenant RLS bounds.
  - `GET /api/webhooks/dlq` - Retrieve dead letter queue messages under active tenant RLS bounds.
- **Verification**: Integration tests verifying multi-tenant RLS isolation on outbox/DLQ tables, successful outbox execution, retry counts, exponential backoff scheduling, and DLQ redirection after 5 failures.
