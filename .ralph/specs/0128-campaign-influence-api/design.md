# Spec 0128: Campaign Influence API Design

## 1. Database Schema (`packages/db/src/schema.ts`)

```typescript
export const campaignInfluence = pgTable("campaign_influence", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  influencePercentage: integer("influence_percentage").notNull(), // 0 to 100
  revenueShare: text("revenue_share").notNull(), // calculated drop-in
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

## 2. Core Business Logic (`packages/core/src/index.ts`)

### Interface Definitions
```typescript
export interface CampaignInfluenceInput {
  campaignId: string;
  opportunityId: string;
  influencePercentage: number;
}

export interface DBCampaignInfluence {
  id: string;
  orgId: string;
  opportunityId: string;
  campaignId: string;
  influencePercentage: number;
  revenueShare: string;
  createdAt: Date;
}
```

### Core Calculations
```typescript
export function calculateCampaignRevenueShare(
  opportunityAmount: string,
  percentage: number,
): string {
  const amount = Number.parseFloat(opportunityAmount) || 0;
  return (amount * (percentage / 100)).toFixed(2);
}

export function validateInfluencePercentageTotal(
  existingInfluences: { influencePercentage: number }[],
  newPercentage: number,
): boolean {
  const currentTotal = existingInfluences.reduce((sum, inf) => sum + inf.influencePercentage, 0);
  return currentTotal + newPercentage <= 100;
}
```

## 3. REST API Endpoints (`apps/api/src/index.ts`)

- `GET /api/opportunities/:id/campaign-influence`
  - Retrieves all campaign influence records associated with the opportunity.
  - Return: `200 OK` with JSON array.

- `POST /api/opportunities/:id/campaign-influence`
  - Payload: `{ campaignId: string, influencePercentage: number }`
  - Flow:
    1. Fetch target Opportunity (verify tenant and exists).
    2. Fetch existing Campaign Influence list for the opportunity.
    3. Validate total percentage does not exceed 100%.
    4. Calculate `revenueShare`.
    5. Insert new record in `campaignInfluence`.
    6. Log `audit_logs` entry.
    7. Dispatch outbound `opportunity.campaign_influence.created` webhook event.
  - Return: `201 Created` with the new campaign influence record.

- `DELETE /api/opportunities/:id/campaign-influence/:influenceId`
  - Flow:
    1. Verify record exists and belongs to the opportunity and tenant.
    2. Delete the record.
    3. Log `audit_logs` entry.
    4. Dispatch outbound `opportunity.campaign_influence.deleted` webhook event.
  - Return: `200 OK` with success confirmation.

- `GET /api/campaigns/:id/attribution`
  - Flow:
    1. Verify Campaign exists.
    2. Find all Campaign Influence records for the campaign.
    3. Filter only opportunities that have stage `"Closed Won"`.
    4. Aggregate sum of `revenueShare`.
  - Return: `200 OK` with `{ totalRevenueAttributed: string }`.
