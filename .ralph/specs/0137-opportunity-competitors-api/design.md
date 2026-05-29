# Spec 0137: Opportunity Competitors API Design

## Database Schema & Storage Types

### Schema Definition (`packages/db/src/schema.ts`)
```typescript
export const opportunityCompetitors = pgTable("opportunity_competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  strength: text("strength"),
  weakness: text("weakness"),
  winLossStatus: text("win_loss_status").notNull().default("Pending"), // "Pending" | "Won" | "Lost"
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### Store Intermediary Types (`packages/db/src/index.ts`)
```typescript
export interface DBOpportunityCompetitor {
  id: string;
  orgId: string;
  opportunityId: string;
  name: string;
  strength: string | null;
  weakness: string | null;
  winLossStatus: string;
  notes: string | null;
  createdAt: Date;
}
```

## Core Calculations API (`packages/core/src/index.ts`)

```typescript
export interface CompetitorInput {
  name: string;
  winLossStatus: string;
}

export interface CompetitorStats {
  competitorCount: number;
  wonCount: number;
  lostCount: number;
  pendingCount: number;
  competitorList: string[];
}

export function calculateOpportunityCompetitorStats(
  competitors: CompetitorInput[]
): CompetitorStats {
  let wonCount = 0;
  let lostCount = 0;
  let pendingCount = 0;
  const competitorList: string[] = [];

  for (const c of competitors) {
    competitorList.push(c.name);
    if (c.winLossStatus === "Won") {
      wonCount++;
    } else if (c.winLossStatus === "Lost") {
      lostCount++;
    } else {
      pendingCount++;
    }
  }

  return {
    competitorCount: competitors.length,
    wonCount,
    lostCount,
    pendingCount,
    competitorList,
  };
}
```

## REST API Interface

### Endpoints
1. `GET /api/opportunities/:id/competitors`
   - Headers: `Authorization: Bearer <session-token>`
   - Response: `200 OK` -> `{ success: true, data: DBOpportunityCompetitor[] }`

2. `POST /api/opportunities/:id/competitors`
   - Headers: `Authorization: Bearer <session-token>`
   - Body:
     ```json
     {
       "name": "Competitor X",
       "strength": "Advanced tech",
       "weakness": "Expensive pricing",
       "winLossStatus": "Pending",
       "notes": "Spoke with client about them"
     }
     ```
   - Response: `201 Created` -> `{ success: true, data: DBOpportunityCompetitor }`

3. `PUT /api/opportunities/:id/competitors/:competitorId`
   - Headers: `Authorization: Bearer <session-token>`
   - Body: Similar to POST (allows partial updates)
   - Response: `200 OK` -> `{ success: true, data: DBOpportunityCompetitor }`

4. `DELETE /api/opportunities/:id/competitors/:competitorId`
   - Headers: `Authorization: Bearer <session-token>`
   - Response: `200 OK` -> `{ success: true }`
