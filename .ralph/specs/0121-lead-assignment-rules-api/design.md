# Task 0121: Lead Assignment Rules & Auto-Routing Engine - Design

## Database Schemas

We will add two new collections to packages/db to represent the routing rules:

```typescript
export const leadAssignmentRules = pgTable("lead_assignment_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(0), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadAssignmentRuleEntries = pgTable("lead_assignment_rule_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => leadAssignmentRules.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull(),
  routingMethod: text("routing_method").notNull(), // "direct" | "round_robin"
  routingUserIds: jsonb("routing_user_ids").notNull(), // string[] (array of User UUIDs)
  lastAssignedIndex: integer("last_assigned_index").notNull().default(-1),
  criteria: jsonb("criteria").notNull(), // CriteriaCondition[]
});
```

### Type Definition for Criteria Conditions
```typescript
export interface CriteriaCondition {
  field: string; // e.g. "company", "email", "custom.region"
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}
```

## stateless Core Utility in `packages/core`

Add to `packages/core/src/index.ts`:

```typescript
export interface CriteriaCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

export interface RuleEntryInput {
  id: string;
  sortOrder: number;
  routingMethod: string;
  routingUserIds: string[];
  lastAssignedIndex: number;
  criteria: CriteriaCondition[];
}

export interface RoutingMatchResult {
  matchedEntryId: string;
  newOwnerId: string;
  newLastAssignedIndex: number;
}

export function evaluateLeadAssignment(
  lead: Record<string, any>,
  entries: RuleEntryInput[]
): RoutingMatchResult | null;
```

## API Endpoint Registrations

Add to `apps/api/src/index.ts`:
- `GET /api/lead-assignment-rules`
- `POST /api/lead-assignment-rules`
- `POST /api/leads/:id/assign`
