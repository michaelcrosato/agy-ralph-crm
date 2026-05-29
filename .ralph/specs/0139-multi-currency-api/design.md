# Spec 0139: Multi-Currency & Exchange Rates Engine Design

## Database Schema & Storage Types

### Schema Definition (`packages/db/src/schema.ts`)
```typescript
export const currencies = pgTable("currencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  isoCode: text("iso_code").notNull(), // Unique ISO code per tenant
  displayName: text("display_name").notNull(),
  symbol: text("symbol").notNull(),
  exchangeRate: text("exchange_rate").notNull(), // Decimal string representation e.g. "1.0000", "0.8500"
  isCorporate: boolean("is_corporate").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Extending `opportunities` table in `packages/db/src/schema.ts`
We must add standard fields to track the local currency code and stored base corporate value for pipeline reports:
```typescript
export const opportunities = pgTable("opportunities", {
  // ... existing fields ...
  currencyCode: text("currency_code").notNull().default("USD"),
  amountCorporate: text("amount_corporate"),
});
```

### Store Intermediary Types (`packages/db/src/index.ts`)
```typescript
export interface DBCurrency {
  id: string;
  orgId: string;
  isoCode: string;
  displayName: string;
  symbol: string;
  exchangeRate: string;
  isCorporate: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Core Calculations API (`packages/core/src/index.ts`)

```typescript
export function convertCurrency(
  amount: string,
  fromRate: string,
  toRate: string
): string {
  const amountVal = Number.parseFloat(amount) || 0;
  const fromR = Number.parseFloat(fromRate) || 1.0;
  const toR = Number.parseFloat(toRate) || 1.0;

  if (fromR <= 0 || toR <= 0) return amountVal.toFixed(2);

  // Convert amount from base currency equivalent and scale
  // exchangeRate represents how much corporate currency is worth 1 units of local currency.
  // E.g., if corporate = USD, local = EUR, exchange_rate = 1.10 (1 EUR = 1.10 USD).
  // amount_corporate = amount_local * exchange_rate
  // Therefore, converting from currency A to currency B:
  // base_equivalent = amount * fromRate
  // target_amount = base_equivalent / toRate
  const baseEquivalent = amountVal * fromR;
  const targetVal = baseEquivalent / toR;

  return targetVal.toFixed(2);
}

export function rollupOpportunityAmountsInBase(
  opportunities: { amount: string; exchangeRate: string }[]
): string {
  const total = opportunities.reduce((acc, opp) => {
    const amountVal = Number.parseFloat(opp.amount) || 0;
    const rate = Number.parseFloat(opp.exchangeRate) || 1.0;
    return acc + amountVal * rate;
  }, 0);

  return total.toFixed(2);
}
```

## REST API Interface

### Endpoints
1. `GET /api/currencies`
   - Headers: `Authorization: Bearer <session-token>`
   - Response: `200 OK` -> `{ success: true, data: DBCurrency[] }`

2. `POST /api/currencies`
   - Headers: `Authorization: Bearer <session-token>`
   - Body:
     ```json
     {
       "isoCode": "EUR",
       "displayName": "Euro",
       "symbol": "€",
       "exchangeRate": "1.0850",
       "isCorporate": false
     }
     ```
   - Response: `201 Created` / `200 OK` -> `{ success: true, data: DBCurrency }`

3. `POST /api/opportunities` & `PATCH /api/opportunities/:id`
   - Headers: `Authorization: Bearer <session-token>`
   - Accepts body with optionally `currencyCode` (e.g. `EUR`).
   - Automatically looks up target exchange rate and saves converted corporate currency amount under `amountCorporate`.
