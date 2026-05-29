# Task 0169: Opportunity Forecast Category Mapping & Category-Based Forecasting Engine - Design

## Database Schema Design

Add `stageForecastMappings` table in `packages/db/src/schema.ts`:
```typescript
export const stageForecastMappings = pgTable("stage_forecast_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  forecastCategory: text("forecast_category").notNull(), // "Omitted" | "Pipeline" | "Best Case" | "Commit" | "Closed"
});
```

Add DB interface in `packages/db/src/index.ts`:
```typescript
export interface DBStageForecastMapping {
  id: string;
  orgId: string;
  stage: string;
  forecastCategory: string; // "Omitted" | "Pipeline" | "Best Case" | "Commit" | "Closed"
}
```

Add the `stageForecastMappings` store adapter within `dbStore` inside `packages/db/src/index.ts`.

## Core Logic Mappings

Add the forecasting helper inside `packages/forecasting/src/index.ts`:
```typescript
export const DEFAULT_STAGE_CATEGORIES: Record<string, string> = {
  Prospecting: "Pipeline",
  Qualification: "Pipeline",
  "Needs Analysis": "Pipeline",
  Proposal: "Best Case",
  Negotiation: "Commit",
  "Closed Won": "Closed",
  "Closed Lost": "Omitted",
};

export interface ForecastCategorySummary {
  category: string;
  actualAmount: number;
  weightedAmount: number;
  count: number;
}

export function compileForecastCategorySummary(params: {
  opportunities: OpportunityInput[];
  stageMappings: Record<string, string>;
  customProbabilities?: Record<string, number>;
}): ForecastCategorySummary[] {
  // Aggregate opportunities by mapping stages to forecast categories
}
```

## API Endpoint Routes

1. **`POST /api/forecasting/stage-mappings`**:
   - Updates or inserts a stage-to-forecast-category mapping for the active tenant.
   - Body format: `{ stage: string, forecastCategory: string }`

2. **`GET /api/forecasting/stage-mappings`**:
   - Returns a list of all mappings for the active tenant.

3. **`GET /api/forecasting/categories-summary?period=YYYY-MM`**:
   - Returns aggregated forecasting pipeline values grouped by forecast categories for the planning period.
