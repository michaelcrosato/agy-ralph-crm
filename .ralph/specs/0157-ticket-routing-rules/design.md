# Specification: Support Ticket Routing & Assignment Rules Engine - Design

## 1. Relational Database Schema Design

### 1.1 Ticket Table Update
We will add `assignedToId` to the existing `tickets` table definition in `packages/db/src/schema.ts`:
```typescript
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("Open"),
  assignedToId: uuid("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 1.2 Ticket Assignment Rules Table
We will define `ticketAssignmentRules` and `ticketAssignmentRuleEntries` tables:
```typescript
export const ticketAssignmentRules = pgTable("ticket_assignment_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(0), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketAssignmentRuleEntries = pgTable("ticket_assignment_rule_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => ticketAssignmentRules.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull(),
  routingMethod: text("routing_method").notNull(), // "direct" | "round_robin"
  routingUserIds: jsonb("routing_user_ids").notNull(), // string[] (array of User UUIDs)
  lastAssignedIndex: integer("last_assigned_index").notNull().default(-1),
  criteria: jsonb("criteria").notNull(), // CriteriaCondition[]
});
```

---

## 2. Core Library pure functions (`packages/core/src/index.ts`)

We will implement `evaluateTicketAssignment` as a pure function:
```typescript
export interface TicketAssignmentRuleEntryInput {
  id: string;
  sortOrder: number;
  routingMethod: string;
  routingUserIds: string[];
  lastAssignedIndex: number;
  criteria: CriteriaCondition[];
}

export interface TicketRoutingMatchResult {
  matchedEntryId: string;
  newAssignedToId: string;
  newLastAssignedIndex: number;
}

export function evaluateTicketAssignment(
  ticket: Record<string, unknown>,
  entries: TicketAssignmentRuleEntryInput[],
): TicketRoutingMatchResult | null {
  const sortedEntries = [...entries].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const entry of sortedEntries) {
    let match = true;
    for (const cond of entry.criteria) {
      let ticketValue: unknown = undefined;
      if (cond.field.startsWith("custom.")) {
        const customField = cond.field.substring("custom.".length);
        ticketValue = (ticket.custom as Record<string, unknown> | null)?.[customField];
      } else {
        ticketValue = ticket[cond.field];
      }

      if (ticketValue === undefined || ticketValue === null) {
        match = false;
        break;
      }

      const tStr = String(ticketValue).toLowerCase();
      const cStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (tStr !== cStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!tStr.includes(cStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const tNum = Number.parseFloat(tStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(tNum) || Number.isNaN(cNum) || tNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const tNum = Number.parseFloat(tStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(tNum) || Number.isNaN(cNum) || tNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match && entry.routingUserIds.length > 0) {
      if (entry.routingMethod === "direct") {
        return {
          matchedEntryId: entry.id,
          newAssignedToId: entry.routingUserIds[0],
          newLastAssignedIndex: -1,
        };
      }
      if (entry.routingMethod === "round_robin") {
        const nextIndex = (entry.lastAssignedIndex + 1) % entry.routingUserIds.length;
        return {
          matchedEntryId: entry.id,
          newAssignedToId: entry.routingUserIds[nextIndex],
          newLastAssignedIndex: nextIndex,
        };
      }
    }
  }

  return null;
}
```

---

## 3. Database Store Updates (`packages/db/src/index.ts`)

We will add `ticketAssignmentRules` and `ticketAssignmentRuleEntries` to the mock `store` and database mapping functions.
- Update interfaces `DBTicketAssignmentRule`, `DBTicketAssignmentRuleEntry`.
- Add `ticketAssignmentRules: [] as DBTicketAssignmentRule[]` and `ticketAssignmentRuleEntries: [] as DBTicketAssignmentRuleEntry[]` to the in-memory mock `store` definition.
- Expose appropriate query helper mappings inside `dbStore`.
