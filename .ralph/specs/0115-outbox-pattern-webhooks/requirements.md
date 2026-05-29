# Specification: Outbox Pattern Webhooks & Dead Letter Queue (DLQ) - Requirements

## 1. Database Schema Specifications

### Webhook Outbox Table (`webhook_outbox`)
- `id`: Unique identifier (UUID primary key).
- `orgId`: Tenant reference, foreign key to `organizations` (cascade delete).
- `webhookId`: Reference to target webhook definition, foreign key to `webhooks` (cascade delete).
- `event`: Webhook event name (e.g. `lead.created`, `lead.converted`, `opportunity.stage_changed`).
- `payload`: Serialized string representation of the webhook event payload.
- `status`: String, defaults to `"pending"`. Allowed values: `"pending"`, `"processing"`, `"failed"`, `"delivered"`.
- `attempts`: Integer, defaults to `0`. Indicates how many times delivery has been attempted.
- `lastAttemptAt`: Timestamp representing the last dispatch attempt (null initially).
- `nextAttemptAt`: Timestamp representing when the next dispatch attempt should occur (defaults to creation time).
- `createdAt`: Creation timestamp (defaults to current time).
- `lastError`: Text representation of the error encountered on the last attempt (null initially).

### Webhook Dead Letter Queue Table (`webhook_dlq`)
- `id`: Unique identifier (UUID primary key).
- `orgId`: Tenant reference, foreign key to `organizations` (cascade delete).
- `webhookId`: Reference to target webhook definition, foreign key to `webhooks` (cascade delete).
- `event`: Webhook event name.
- `payload`: Serialized string representation of the webhook event payload.
- `failedAt`: Timestamp of DLQ transition (defaults to current time).
- `attempts`: Integer (number of total attempts, should be 5).
- `lastError`: Error message details from final failed delivery attempt.

---

## 2. Core Business Logic Requirements

### Outbox Enqueueing
- When a CRM event occurs (such as lead creation, conversion, or opportunity stage change), rather than performing an immediate fire-and-forget REST execution, a `webhook_outbox` entry must be created for every active webhook subscription.
- This insertion must occur under active tenant RLS bounds.

### Outbox Processor Loop
- The outbox processor identifies pending messages to process:
  - Filter `webhook_outbox` entries where `status` is `"pending"` or `"failed"`.
  - Ensure `nextAttemptAt` is less than or equal to the current time.
  - Limit the query to active tenant scope under RLS context.
- For each message:
  1. Transition status to `"processing"`.
  2. Perform delivery using `simulateWebhookDispatch`.
  3. If status code is `200` (success):
     - Transition status to `"delivered"`.
     - Insert a record into `webhook_deliveries`.
     - Delete or mark completed the outbox entry (in our mock store, we can delete the outbox entry upon successful delivery).
  4. If status code is not `200` (failure):
     - Increment `attempts` counter.
     - If `attempts` reaches `5`:
       - Move the record to `webhook_dlq` store.
       - Create an audit log record denoting system failure/DLQ transition.
       - Delete the outbox entry.
     - If `attempts` < `5`:
       - Calculate exponential backoff: `2^attempts` seconds.
       - Update `status` to `"failed"`.
       - Update `lastAttemptAt` to current time.
       - Update `nextAttemptAt` to `current time + (2^attempts) seconds`.
       - Update `lastError` with a failure description (e.g. `HTTP 500`).
       - Insert a record into `webhook_deliveries` reflecting the failure.

---

## 3. REST API Requirements

### GET `/api/webhooks/outbox`
- Returns all outbox items matching the active tenant org ID.
- Strict tenant RLS checks apply.

### GET `/api/webhooks/dlq`
- Returns all DLQ items matching the active tenant org ID.
- Strict tenant RLS checks apply.

### POST `/api/webhooks/process-outbox`
- Triggers processing of all eligible outbox items.
- Returns execution summary (number of successes, failures, DLQ transitions).
- Strict tenant RLS checks apply.
