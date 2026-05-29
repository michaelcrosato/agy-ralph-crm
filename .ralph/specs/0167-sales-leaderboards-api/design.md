# Task 0167: Sales Leaderboards & Quota Attainment API - Design

## Core Logic & Calculation Utility (`packages/core/src/index.ts`)

Implement and export the following functions and types:

```typescript
export interface LeaderboardRepInput {
  userId: string;
  userName: string;
}

export interface LeaderboardOpportunityInput {
  id: string;
  ownerId: string;
  stage: string;
  amount: string | null;
  closeDate: Date | null;
}

export interface LeaderboardQuotaInput {
  userId: string;
  period: string;
  targetAmount: string;
}

export interface LeaderboardRepResult {
  userId: string;
  userName: string;
  totalClosedWon: number;
  quotaTarget: number;
  attainmentPercentage: number;
  rank: number;
}

export interface LeaderboardResult {
  period: string;
  leaderboard: LeaderboardRepResult[];
}

export function isDateInPeriod(date: Date, period: string): boolean {
  if (!date || Number.isNaN(date.getTime())) return false;
  const iso = date.toISOString();
  const year = iso.substring(0, 4);
  const monthStr = iso.substring(5, 7);
  const month = Number.parseInt(monthStr, 10);

  if (period.includes("-Q")) {
    const [qYear, qStr] = period.split("-Q");
    if (year !== qYear) return false;
    const quarter = Math.ceil(month / 3);
    return `Q${quarter}` === qStr;
  } else {
    return iso.substring(0, 7) === period;
  }
}

export function calculateSalesLeaderboard(params: {
  period: string;
  users: LeaderboardRepInput[];
  opportunities: LeaderboardOpportunityInput[];
  quotas: LeaderboardQuotaInput[];
}): LeaderboardResult;
```

## API Endpoint Routing (`apps/api/src/index.ts`)

Expose a new endpoint `GET /api/leaderboards` protected by `tenantAuth`:
- Accepts query param `period` (validated/normalized, defaults to `YYYY-MM` of current date).
- Fetches all memberships and users to resolve representative names.
- Queries `opportunities` and `quotas` for the active tenant.
- Invokes `calculateSalesLeaderboard`.
- Returns `200 OK` with JSON response matching `LeaderboardResult`.
