# Specification: Analytical Reporting & Saved Views REST API - Design

## Database Extension

We will extend `packages/db/src/schema.ts` and `packages/db/src/index.ts` with the `reports` table schema and interfaces.

### schema.ts
```typescript
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  objectType: text("object_type").notNull(), // "leads" | "opportunities" | "tickets" | "accounts" | "contacts"
  groupBy: text("group_by").notNull(),
  aggregateField: text("aggregate_field"),
  aggregateFunc: text("aggregate_func").notNull().default("count"), // "count" | "sum" | "avg"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### index.ts
```typescript
export interface DBReport {
  id: string;
  orgId: string;
  name: string;
  objectType: "leads" | "opportunities" | "tickets" | "accounts" | "contacts";
  groupBy: string;
  aggregateField: string | null;
  aggregateFunc: "count" | "sum" | "avg";
  createdAt: Date;
}
```

We will add `reports` to the in-memory `store` and expose `findMany`, `findOne`, and `insert` under `dbStore.reports`. We will also ensure `clear()` resets `store.reports`.

## Reporting Engine Layer (`packages/reporting`)

The function `runReport(report: ReportDef)` inside `packages/reporting` will execute the dynamic grouping and aggregation:

```typescript
export interface ReportRunResult {
  reportName: string;
  objectType: string;
  groupBy: string;
  aggregateFunc: string;
  aggregateField: string | null;
  data: {
    group: string;
    value: number;
  }[];
}
```

It will fetch the target tenant records using `dbStore[objectType].findMany()`, group them by the specified key (inspecting top-level keys first, then custom JSONB properties), and compute the aggregation metric (count, sum, or average).

## API Routing Layout

The Hono routes inside `apps/api/src/index.ts` will support:

- `POST /api/reports`
  - Accepts payload: `{ name: string, objectType: string, groupBy: string, aggregateField?: string, aggregateFunc?: string }`.
  - Saves the report definition.

- `GET /api/reports`
  - Retrieves all saved report definitions for the active organization.

- `POST /api/reports/run`
  - Accepts a report definition payload ad-hoc and executes `runReport`, returning the analytical output.

- `GET /api/reports/:id/run`
  - Retrieves a saved report by ID, validates organization access, executes `runReport`, and returns the results.
