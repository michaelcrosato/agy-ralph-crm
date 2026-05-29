# Specification: Opportunity Kanban Board Pipeline View API - Design

## 1. Core Data Aggregator (`packages/core/src/index.ts`)

To support fast, unified pipeline calculations, we will add a pure domain function:

```typescript
export interface KanbanStageSummary {
  stage: string;
  opportunitiesCount: number;
  totalValue: string;
  opportunities: {
    id: string;
    name: string;
    amount: string | null;
    closeDate: Date | null;
    accountId: string | null;
  }[];
}

export function compileKanbanPipeline(
  opportunities: {
    id: string;
    name: string;
    stage: string;
    amount: string | null;
    closeDate: Date | null;
    accountId: string | null;
  }[],
  standardStages: string[] = [
    "Prospecting",
    "Qualification",
    "Needs Analysis",
    "Value Proposition",
    "Id. Decision Makers",
    "Perception Analysis",
    "Proposal/Price Quote",
    "Negotiation/Review",
    "Closed Won",
    "Closed Lost"
  ]
): KanbanStageSummary[] {
  const summaries: Record<string, KanbanStageSummary> = {};

  // Initialize summary blocks for standard stages to ensure they are always present
  for (const stage of standardStages) {
    summaries[stage] = {
      stage,
      opportunitiesCount: 0,
      totalValue: "0.00",
      opportunities: [],
    };
  }

  for (const opp of opportunities) {
    const stage = opp.stage;
    if (!summaries[stage]) {
      summaries[stage] = {
        stage,
        opportunitiesCount: 0,
        totalValue: "0.00",
        opportunities: [],
      };
    }

    const summary = summaries[stage];
    summary.opportunitiesCount += 1;
    
    const currentSum = Number.parseFloat(summary.totalValue) || 0;
    const oppVal = Number.parseFloat(opp.amount || "0") || 0;
    summary.totalValue = (currentSum + oppVal).toFixed(2);
    
    summary.opportunities.push({
      id: opp.id,
      name: opp.name,
      amount: opp.amount,
      closeDate: opp.closeDate,
      accountId: opp.accountId,
    });
  }

  return Object.values(summaries);
}
```

## 2. Hono API Routes (`apps/api/src/index.ts`)

- **GET `/api/opportunities/kanban`**: Fetch the Kanban pipeline view. Retrieves all opportunities for the active tenant, compiles summaries via `compileKanbanPipeline`, and returns the results.
- **POST `/api/opportunities/kanban/transition`**: Execute a stage transition. Requires body parameters: `opportunityId` and `targetStage`.
  - Authenticates and loads the opportunity (ensuring RLS is respected).
  - Fetches the active tenant's stage gates via `dbStore.opportunityStageGates.findMany()`.
  - Runs gate checks via `validateOpportunityStageGate` core logic helper.
  - Updates the opportunity stage, writes `opportunityStageHistory`, `auditLogs`, triggers `executeWorkflows`, and dispatches outbound webhooks.
