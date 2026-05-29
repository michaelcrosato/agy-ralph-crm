# Specification: Sales Pipeline Stalled Alerts API - Design

## 1. Database Schema Extensions

### 1.1 Drizzle ORM Table: `opportunity_stage_duration_rules`
```typescript
export const opportunityStageDurationRules = pgTable("opportunity_stage_duration_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  maxDaysAllowed: integer("max_days_allowed").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### 1.2 TypeScript Interfaces
```typescript
export interface DBOpportunityStageDurationRule {
  id: string;
  orgId: string;
  stage: string;
  maxDaysAllowed: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### 1.3 In-Memory DB Store
Export `opportunityStageDurationRules` in `dbStore`:
```typescript
opportunityStageDurationRules: {
  findMany: () => Promise<DBOpportunityStageDurationRule[]>;
  findByStage: (stage: string) => Promise<DBOpportunityStageDurationRule | null>;
  upsert: (rule: Omit<DBOpportunityStageDurationRule, "id" | "createdAt" | "updatedAt">) => Promise<DBOpportunityStageDurationRule>;
}
```

---

## 2. Core pure calculation logic: `calculateStalledOpportunities`

```typescript
export interface StalledOpportunityResult {
  opportunityId: string;
  opportunityName: string;
  currentStage: string;
  elapsedDays: number;
  maxDaysAllowed: number;
  amount: string | null;
}

export function calculateStalledOpportunities(
  opportunities: any[],
  stageHistory: any[],
  rules: any[],
  currentDate: Date = new Date()
): StalledOpportunityResult[]
```

---

## 3. REST Routes in `apps/api/src/index.ts`

- `GET /api/opportunities/stalled`
  - Fetches all active opportunities for the tenant.
  - Fetches `opportunityStageHistory` for the tenant.
  - Fetches `opportunityStageDurationRules` for the tenant.
  - Runs pure calculation utility `calculateStalledOpportunities`.
  - Returns calculated list.
- `GET /api/opportunities/stalled/rules`
  - Fetches `opportunityStageDurationRules` and returns them.
- `POST /api/opportunities/stalled/rules`
  - Parses body validation (Zod schema checking `stage` and `maxDaysAllowed`).
  - Upserts rule under active tenant context.
  - Returns rule.
