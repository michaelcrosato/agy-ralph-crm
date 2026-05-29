# Task 0123: Opportunity Splits & Multi-Rep Commission Allocation - Design

## 1. Database Schema Specifications

We will define a new Drizzle table `opportunity_splits` in `packages/db/src/schema.ts` and update the mock store in `packages/db/src/index.ts`.

### 1.1 `opportunity_splits` Table in `schema.ts`
```typescript
export const opportunitySplits = pgTable("opportunity_splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  percentage: integer("percentage").notNull(), // 0 to 100
  splitAmount: text("split_amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 1.2 `index.ts` updates in `packages/db`
- Add interface:
```typescript
export interface DBOpportunitySplit {
  id: string;
  orgId: string;
  opportunityId: string;
  userId: string;
  percentage: number;
  splitAmount: string;
}
```
- Extend `store` in `packages/db/src/index.ts` with `opportunitySplits: [] as DBOpportunitySplit[]`.
- Add `dbStore.opportunitySplits` CRUD operations:
  - `findMany`: returns splits for current orgId
  - `findOne`: returns split by ID under active orgId
  - `insert`: inserts split validating active orgId context
  - `update`: updates split percentage/splitAmount under active orgId context
  - `delete`: deletes split by ID under active orgId context
  - `deleteManyForOpportunity`: helper to delete all splits for an opportunity

---

## 2. Core Package Mappings (`packages/core`)

Extend `packages/core/src/index.ts` with types and split evaluation pure functions.

### 2.1 Types
```typescript
export interface SplitInput {
  userId: string;
  percentage: number;
}

export interface SplitResult {
  userId: string;
  percentage: number;
  splitAmount: string;
}
```

### 2.2 Split Calculation Function
```typescript
export function calculateOpportunitySplits(
  opportunityAmount: string,
  splits: SplitInput[]
): SplitResult[] {
  const amount = Number.parseFloat(opportunityAmount) || 0;
  const totalPct = splits.reduce((sum, s) => sum + s.percentage, 0);
  if (totalPct !== 100) {
    throw new Error("Total split percentage must equal 100%.");
  }
  return splits.map(s => ({
    userId: s.userId,
    percentage: s.percentage,
    splitAmount: (amount * (s.percentage / 100)).toFixed(2)
  }));
}
```

---

## 3. REST API Specifications (`apps/api`)

- `POST /api/opportunities/:id/splits`
  - Overwrites splits for an opportunity.
  - Updates associated commissions using calculated split amounts if Closed Won.
- `GET /api/opportunities/:id/splits`
  - Fetches all active splits for the opportunity.
- `DELETE /api/opportunities/:id/splits`
  - Removes all splits and resets standard commissions for the opportunity owner.
