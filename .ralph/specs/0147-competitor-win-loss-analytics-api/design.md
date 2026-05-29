# Specification: Competitor Win/Loss & Performance Analytics API - Design

## 1. Relational Store & Data Mapping
This feature does not require modifying the existing `packages/db` schema, as the underlying `opportunityCompetitors` and `opportunities` tables are already present and RLS isolated. We will query these tables under the active tenant's context and aggregate them.

### Active Tables Reference:
```typescript
// packages/db/src/schema.ts
export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  stage: text("stage").notNull().default("Prospecting"),
  amount: text("amount"),
  // ... other fields
});

export const opportunityCompetitors = pgTable("opportunity_competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  strength: text("strength"),
  weakness: text("weakness"),
  winLossStatus: text("win_loss_status").notNull().default("Pending"), // "Pending" | "Won" | "Lost"
  // ... other fields
});
```

---

## 2. Core Business Logic Engine
The calculation logic will be implemented as a pure function in `packages/core/src/index.ts`.

### Mathematical Specifications:
- Trim and normalize competitor names for grouping: `name.trim().toLowerCase()`.
- Grouping must preserve the casing of the first competitor encountered.
- Win Rate calculation:
  ```typescript
  const totalDecided = wonCount + lostCount;
  const winRate = totalDecided > 0 ? Math.round((wonCount / totalDecided) * 100 * 100) / 100 : 0.0;
  ```
- Summing amounts:
  ```typescript
  const parsedAmount = Number.parseFloat(opp.amount || "0") || 0;
  ```

---

## 3. REST API Endpoint Design
Expose route inside `apps/api/src/index.ts`:

### Route: `GET /api/reports/competitor-analytics`
- Middleware: `tenantAuth` (secures tenancy isolation at application entry).
- Execution Flow:
  1. Retrieve active `tenant` from context: `c.get("tenant")`.
  2. Fetch all competitors and opportunities. In our Drizzle-based RLS in-memory store, `dbStore` fetches will automatically be filtered under active tenant RLS bounds.
  3. Filter competitors to make sure they belong to the active org (redundancy check).
  4. Call the core utility `calculateGlobalCompetitorAnalytics` with the fetched arrays.
  5. Return list of aggregated metric entries as JSON with HTTP `200 OK`.
