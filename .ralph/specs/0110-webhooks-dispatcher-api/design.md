# Specification: Multi-Tenant Outbound REST Webhooks Dispatcher - Design

## Database Schema (Drizzle ORM)

We will use the existing `webhooks` schema and add a new `webhookDeliveries` table:

```typescript
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  webhookId: uuid("webhook_id").notNull(),
  event: text("event").notNull(),
  statusCode: integer("status_code").notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

---

## Webhooks Package Engine Contract

In `packages/webhooks/src/index.ts`:

```typescript
export interface WebhookEventPayload {
  event: string;
  payload: Record<string, unknown>;
}

export interface WebhookConfig {
  id: string;
  orgId: string;
  targetUrl: string;
  secret: string | null;
  status: string;
}

export interface DeliveryOutcome {
  webhookId: string;
  event: string;
  statusCode: number;
  payload: string;
  signature: string | null;
}

export function computeHmacSignature(payload: string, secret: string): string;
export function simulateWebhookDispatch(
  config: WebhookConfig,
  event: WebhookEventPayload
): Promise<DeliveryOutcome>;
```

---

## REST Endpoints Matrix

- `POST /api/webhooks` - Expects `{ targetUrl, secret }`
- `GET /api/webhooks` - Returns subscriptions
- `GET /api/webhooks/deliveries` - Returns deliveries
