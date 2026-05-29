# Task 0168: Forecast Adjustments & Manager Target Overrides API - Design

## Database Schema (`packages/db/src/schema.ts`)

Add the following table definition:

```typescript
export const forecastAdjustments = pgTable("forecast_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  adjustedByUserId: uuid("adjusted_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // e.g. "2026-05"
  amount: text("amount").notNull(),
  adjustmentType: text("adjustment_type").notNull(), // "override_quota" | "override_weighted" | "manager_adjustment"
  comments: text("comments"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Update `packages/db/src/index.ts` to add interfaces, register in mock collections, and export standard CRUD hooks for `forecastAdjustments`.

## Core Logic & Calculation Utility (`packages/core/src/index.ts`)

Implement and export the following interfaces and functions:

```typescript
export interface ForecastAdjustmentInput {
  userId: string;
  period: string;
  amount: string;
  adjustmentType: string;
}

export interface AdjustedForecastSummaryResult {
  period: string;
  baseQuota: number;
  adjustedQuota: number;
  baseWeightedAmount: number;
  adjustedWeightedAmount: number;
  baseAttainment: number;
  adjustedAttainment: number;
}

export function calculateAdjustedForecast(params: {
  period: string;
  baseQuota: number;
  baseWeightedAmount: number;
  closedWonAmount: number;
  adjustments: ForecastAdjustmentInput[];
}): AdjustedForecastSummaryResult;
```

## API Endpoint Routing (`apps/api/src/index.ts`)

Expose new Hono endpoints under `tenantAuth`:
- `GET /api/forecasts/adjustments`: List all forecast adjustments.
- `POST /api/forecasts/adjustments`: Create a new forecast adjustment.
- `GET /api/forecasts/adjusted-summary`: Calculates and returns an adjusted forecast summary for a given period.
