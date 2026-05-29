# Specification: Outbox Pattern Webhooks & Dead Letter Queue (DLQ) - Design

## 1. Database Schema Extensions (`packages/db/src/schema.ts`)

We will add the following Drizzle schemas to `packages/db/src/schema.ts`:

```typescript
export const webhookOutbox = pgTable("webhook_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastError: text("last_error"),
});

export const webhookDlq = pgTable("webhook_dlq", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  failedAt: timestamp("failed_at").notNull().defaultNow(),
  attempts: integer("attempts").notNull(),
  lastError: text("last_error"),
});
```

---

## 2. In-Memory Store & RLS Verification (`packages/db/src/index.ts`)

We will add the interfaces:
- `DBWebhookOutbox`
- `DBWebhookDlq`

We will add fields to `store`:
- `webhookOutbox: [] as DBWebhookOutbox[]`
- `webhookDlq: [] as DBWebhookDlq[]`

We will add handlers inside `dbStore`:
- `webhookOutbox` with `findMany`, `findOne`, `insert`, `update`, `delete`.
- `webhookDlq` with `findMany`, `findOne`, `insert`.

All operations will verify that `orgId` equals the context tenant `orgId` via `getActiveOrgId()`.

---

## 3. Core Outbox Logic (`packages/webhooks/src/index.ts`)

We will add the following core operations to `packages/webhooks`:
- `processOutboxItems(orgId: string, dbStoreInstance: any): Promise<ProcessSummary>`
- Modify or add a method for enqueueing outbound webhooks instead of immediate processing:
  - `enqueueOutboundWebhooks(orgId: string, event: string, payload: Record<string, unknown>, dbStoreInstance: any): Promise<void>`

The processing logic implements:
- Exponential backoff: `Math.pow(2, attempts) * 1000` milliseconds or seconds.
- DLQ movement: If `attempts` reaches `5`.

---

## 4. API Endpoint Integration (`apps/api/src/index.ts`)

Endpoints to register:
- `GET /api/webhooks/outbox` -> Lists active tenant's pending/failed outbox events.
- `GET /api/webhooks/dlq` -> Lists active tenant's DLQ failed deliveries.
- `POST /api/webhooks/process-outbox` -> Triggers processing of the outbox.
- Update Hono's `triggerOutboundWebhooks` helper to enqueue outbox records instead of executing REST calls immediately.
