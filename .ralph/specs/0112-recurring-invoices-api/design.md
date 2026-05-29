# Specification: Recurring Invoicing & Subscription Billing API - Design

## 1. Relational Database Additions (`packages/db/src/schema.ts`)

```typescript
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  planName: text("plan_name").notNull(),
  status: text("status").notNull().default("active"),
  billingPeriod: text("billing_period").notNull(), // "monthly" | "annually"
  unitPrice: text("unit_price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  amount: text("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("Unpaid"), // "Unpaid" | "Paid"
});
```

*Note*: Corresponding in-memory stubs must be added to `packages/db/src/index.ts` under `store` and `dbStore` interfaces to support fast unit/integration testing without requiring a live Postgres database instance.

## 2. Core Billing Functions (`packages/core/src/index.ts`)

```typescript
export interface ProRateInput {
  unitPrice: string;
  quantity: number;
  daysUsed: number;
  daysInPeriod: number;
}

export function calculateProRatedAmount(input: ProRateInput): string {
  const price = Number.parseFloat(input.unitPrice) || 0;
  const rawAmount = price * input.quantity * (input.daysUsed / input.daysInPeriod);
  return rawAmount.toFixed(2);
}
```

## 3. Hono API Routes (`apps/api/src/index.ts`)

- **POST `/api/subscriptions`**: Insert a new subscription. Requires body parameters: `accountId`, `planName`, `billingPeriod`, `unitPrice`, `quantity`, `startDate`.
- **GET `/api/subscriptions`**: List all subscriptions associated with the authenticated tenant.
- **POST `/api/invoices/generate`**: Iterate active subscriptions for the tenant, calculate totals (pro-rated if necessary), and generate corresponding `invoices` records.
- **GET `/api/invoices`**: List all invoices associated with the authenticated tenant.
