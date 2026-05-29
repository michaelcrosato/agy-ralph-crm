# Specification: Competitor Win/Loss & Performance Analytics API - Requirements

## 1. Functional Requirements

### 1.1 Data Aggregation & Core Rules
- **Competitor Identification**: Competitors must be grouped and aggregated by case-insensitive name (trimmed and lowercased for grouping but displayed using the first encountered formatting).
- **Competition Inclusion**: An opportunity is considered a competition for a competitor if there is an entry in the `opportunityCompetitors` store matching that competitor's name and that opportunity.
- **Win/Loss Attribution**:
  - A competition is **Won** if the opportunity stage is `"Closed Won"` and the competitor's status on that opportunity was `"Lost"` (meaning we won, competitor lost).
  - A competition is **Lost** if the opportunity stage is `"Closed Lost"` and the competitor's status on that opportunity was `"Won"` (meaning we lost, competitor won).
  - Other stages or competitor statuses (e.g. pending, active stages) do not increment won or lost counts but contribute to the total competition count and total opportunity value.
- **Win Rate Calculation**:
  - Formula: `(wonCount / (wonCount + lostCount)) * 100`.
  - The value must be formatted as a number with up to 2 decimal places.
  - If both `wonCount` and `lostCount` are zero, the win rate must default to `0.0`.
- **Financial Rollups**:
  - **Total Opportunity Value**: Consolidated sum of `amount` from all opportunities where the competitor was present.
  - **Won Opportunity Value**: Consolidated sum of `amount` from won opportunities where the competitor was defeated.
  - All financial strings (amounts) must be parsed safely as numbers, and final sums formatted to 2 decimal places.
- **Text Compilation**:
  - **Strengths**: Accumulate all non-empty `strength` strings, returning a list of unique, trimmed values.
  - **Weaknesses**: Accumulate all non-empty `weakness` strings, returning a list of unique, trimmed values.

### 1.2 Tenant RLS Isolation
- Under no circumstances should competitor logs or opportunity details from organization A be mixed into or visible in organization B's competitor report.
- The API endpoint must enforce standard `tenantAuth` middleware context propagation.

---

## 2. Interface Requirements

### 2.1 Core Domain API
A pure function `calculateGlobalCompetitorAnalytics` must be exported from `packages/core`:
```typescript
export interface CompetitorRecord {
  id: string;
  orgId: string;
  opportunityId: string;
  name: string;
  strength: string | null;
  weakness: string | null;
  winLossStatus: string; // "Pending" | "Won" | "Lost"
}

export interface OpportunityRecord {
  id: string;
  orgId: string;
  stage: string;
  amount: string | null;
}

export interface GlobalCompetitorMetrics {
  name: string;
  totalCompetitions: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  totalValue: string;
  wonValue: string;
  strengths: string[];
  weaknesses: string[];
}

export function calculateGlobalCompetitorAnalytics(params: {
  competitors: CompetitorRecord[];
  opportunities: OpportunityRecord[];
}): GlobalCompetitorMetrics[];
```

### 2.2 REST Endpoint
`GET /api/reports/competitor-analytics`
- **Request Headers**: Must pass tenant authorization context (handled by `tenantAuth` middleware).
- **Response Format**:
  ```json
  {
    "success": true,
    "data": [
      {
        "name": "Competitor A",
        "totalCompetitions": 5,
        "wonCount": 3,
        "lostCount": 1,
        "winRate": 75.0,
        "totalValue": "250000.00",
        "wonValue": "150000.00",
        "strengths": ["Fast delivery", "Low price"],
        "weaknesses": ["Poor support"]
      }
    ]
  }
  ```
- **Error Responses**:
  - `401 Unauthorized` if tenant authorization context is missing or invalid.
