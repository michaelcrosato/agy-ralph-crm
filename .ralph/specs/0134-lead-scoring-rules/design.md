# Spec 0134: Lead Scoring Rules Design

## 1. Database Schema
We will add the `leadScoringRules` table definition in `packages/db/src/schema.ts`:

```typescript
export const leadScoringRules = pgTable("lead_scoring_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  criteria: jsonb("criteria").notNull(), // DBCriteriaCondition[]
  scoreValue: integer("score_value").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

We will also update `packages/db/src/index.ts` to add interfaces, the memory store collection `leadScoringRules`, and the `dbStore.leadScoringRules` operations context.

## 2. Core Business Logic (`packages/core`)
We will implement `calculateLeadScore` in `packages/core/src/index.ts`:

```typescript
export interface ScoringRuleInput {
  id: string;
  isActive: number;
  scoreValue: number;
  criteria: CriteriaCondition[];
}

export function calculateLeadScore(
  lead: Record<string, unknown>,
  rules: ScoringRuleInput[],
): number {
  let score = 0;
  const activeRules = rules.filter((r) => r.isActive === 1);

  for (const rule of activeRules) {
    let match = true;
    for (const cond of rule.criteria) {
      let val: unknown = undefined;
      if (cond.field.startsWith("custom.")) {
        const customField = cond.field.substring("custom.".length);
        val = (lead.custom as Record<string, unknown> | null)?.[customField];
      } else {
        val = lead[cond.field];
      }

      if (val === undefined || val === null) {
        match = false;
        break;
      }

      const valStr = String(val).toLowerCase();
      const condStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (valStr !== condStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!valStr.includes(condStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match) {
      score += rule.scoreValue;
    }
  }

  return score;
}
```

## 3. API Routing Endpoints (`apps/api`)
We will add four routes in `apps/api/src/index.ts`:
- **GET `/api/lead-scoring-rules`**: Fetch rules belonging to the active tenant.
- **POST `/api/lead-scoring-rules`**: Insert rule under the active tenant context. Log an audit log of action `create_scoring_rule`.
- **GET `/api/leads/:id/score`**: Fetch the lead, fetch active scoring rules, evaluate and return `{ leadId: string, score: number }`.
- **POST `/api/leads/:id/score/recalculate`**: Evaluate lead score, update lead `custom` JSONB with `score` attribute, log audit log of action `recalculate_lead_score`, and trigger standard webhook dispatch for `lead.score_updated`.
