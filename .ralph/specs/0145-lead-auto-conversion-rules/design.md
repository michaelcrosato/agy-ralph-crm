# Specification: Lead Auto-Conversion Rules & Criteria Engine - Design

## 1. Database Schema Extensions

We will extend `packages/db/src/schema.ts` to include the `leadAutoConversionRules` table, and register it in `packages/db/src/index.ts` memory store.

### Database Table Definition: `lead_auto_conversion_rules`
```typescript
export const leadAutoConversionRules = pgTable("lead_auto_conversion_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  createOpportunity: integer("create_opportunity").notNull().default(1), // 0 = false, 1 = true
  opportunityStage: text("opportunity_stage").notNull().default("Qualification"),
  criteria: jsonb("criteria").notNull(), // { field: string, operator: string, value: string | number }
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### TypeScript Interfaces & Memory Store
In `packages/db/src/index.ts`:
```typescript
export interface DBLeadAutoConversionRule {
  id: string;
  orgId: string;
  name: string;
  isActive: number;
  createOpportunity: number;
  opportunityStage: string;
  criteria: {
    field: "score" | "status" | string;
    operator: "equals" | "greater_or_equal" | "less_or_equal";
    value: string | number;
  };
  createdAt: Date;
}
```

We will add `leadAutoConversionRules` array to the global mock `store` and implement the standard RLS isolation wrapper routines under `dbStore.leadAutoConversionRules`.

## 2. Core Business Logic Engine
In `packages/core/src/index.ts`, we define pure helper functions:
```typescript
export interface AutoConversionCriteria {
  field: string;
  operator: "equals" | "greater_or_equal" | "less_or_equal";
  value: string | number;
}

export function evaluateLeadAutoConversion(
  lead: { status: string; custom?: Record<string, unknown> | null },
  leadScore: number,
  criteria: AutoConversionCriteria,
): boolean {
  const { field, operator, value } = criteria;
  let leadValue: string | number | undefined;

  if (field === "score") {
    leadValue = leadScore;
  } else if (field === "status") {
    leadValue = lead.status;
  } else if (lead.custom && typeof lead.custom === "object" && field in lead.custom) {
    leadValue = lead.custom[field] as string | number;
  }

  if (leadValue === undefined) return false;

  if (operator === "equals") {
    return String(leadValue) === String(value);
  }
  if (operator === "greater_or_equal") {
    return Number(leadValue) >= Number(value);
  }
  if (operator === "less_or_equal") {
    return Number(leadValue) <= Number(value);
  }

  return false;
}
```

## 3. REST API Routes
In `apps/api/src/index.ts`:
- `GET /api/leads/auto-conversion-rules` - Returns list of active rules for the tenant.
- `POST /api/leads/auto-conversion-rules` - Creates a new rule under RLS.
- Hook Lead conversion check in Lead creation/update workflows:
  - When a Lead is updated, fetch rules, evaluate criteria, and if matched, execute the database transactions to auto-convert the Lead to Account, Contact, and Opportunity inside `withTenant`.
