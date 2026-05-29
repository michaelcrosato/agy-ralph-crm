# Specification: Sales Forecasting & Quota Engine - Design

## Database Schema (Drizzle ORM)

We will define two new structures in `packages/db/src/schema.ts` and their interface representation in `packages/db/src/index.ts`:

### 1. `quotas` Table
- `id`: uuid (primary key)
- `orgId`: uuid (tenant ID)
- `userId`: uuid (user ID)
- `period`: text (e.g., `2026-Q2`, `2026-05`)
- `targetAmount`: text (numeric target string)

### 2. `stageProbabilities` Table
- `id`: uuid (primary key)
- `orgId`: uuid
- `stage`: text (non-nullable)
- `probability`: integer (0 to 100)

---

## Forecasting Engine Core Contract

In `packages/forecasting/src/index.ts`:

```typescript
export interface OpportunityInput {
  id: string;
  stage: string;
  amount: string | null;
  closeDate: Date | null;
}

export interface ProbabilityMap {
  [stage: string]: number;
}

export interface ForecastSummaryResult {
  totalPipelineAmount: number;
  totalWeightedAmount: number;
  attainmentPercentage: number;
  byPeriod: {
    period: string;
    actualAmount: number;
    weightedAmount: number;
    count: number;
  }[];
}
```

---

## API Endpoints Matrix

- `POST /api/quotas` - Expects `{ userId, period, targetAmount }`
- `GET /api/quotas` - Returns saved quotas
- `POST /api/forecasting/probabilities` - Expects `{ stage, probability }`
- `GET /api/forecasting/probabilities` - Returns active probabilities
- `GET /api/forecasting/summary` - Accepts optional query params `?period=2026-Q2` and returns compiled `ForecastSummaryResult`
