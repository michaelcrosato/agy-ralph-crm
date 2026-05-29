# Specification: Support Ticket SLA Alerts & Breaches Escalation Engine - Design

## 1. Relational Database Schema Design

### 1.1 Ticket Table Update
We will add a `priority` field to the existing `tickets` table definition in `packages/db/src/schema.ts`:
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
  priority: text("priority").notNull().default("Medium"), // "Low" | "Medium" | "High" | "Urgent"
  assignedToId: uuid("assigned_to_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 1.2 Ticket Escalation Rules Table
We will define `ticketEscalationRules` and `ticketEscalations` tables:
```typescript
export const ticketEscalationRules = pgTable("ticket_escalation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(), // "milestone_approaching" | "milestone_breached"
  timeThresholdMinutes: integer("time_threshold_minutes").notNull().default(0),
  escalateToId: uuid("escalate_to_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  newPriority: text("new_priority"), // "High" | "Urgent"
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketEscalations = pgTable("ticket_escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").references(() => ticketEscalationRules.id, {
    onDelete: "set null",
  }),
  previousAssignedToId: uuid("previous_assigned_to_id").references(() => users.id, {
    onDelete: "set null",
  }),
  escalatedToId: uuid("escalated_to_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  previousPriority: text("previous_priority"),
  newPriority: text("new_priority"),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

---

## 2. Core Library Pure Functions (`packages/core/src/index.ts`)

We will implement `evaluateTicketEscalation` as a pure function:
```typescript
export interface TicketEscalationRuleInput {
  id: string;
  name: string;
  triggerType: string;
  timeThresholdMinutes: number;
  escalateToId: string;
  newPriority: string | null;
  isActive: number;
}

export interface TicketMilestoneInput {
  id: string;
  milestoneType: string;
  targetTime: Date;
  status: string;
  completedAt: Date | null;
}

export interface TicketEscalationResult {
  ruleId: string;
  escalateToId: string;
  newPriority: string | null;
  reason: string;
}

export function evaluateTicketEscalation(
  ticket: { priority: string; assignedToId: string | null },
  milestones: TicketMilestoneInput[],
  rules: TicketEscalationRuleInput[],
  currentTime: Date = new Date(),
): TicketEscalationResult | null {
  const activeRules = rules.filter((r) => r.isActive === 1);

  for (const rule of activeRules) {
    for (const ms of milestones) {
      // 1. milestone_breached evaluation
      if (rule.triggerType === "milestone_breached") {
        const isBreached =
          ms.status === "breached" ||
          (ms.status === "pending" && currentTime.getTime() > ms.targetTime.getTime());

        if (isBreached) {
          return {
            ruleId: rule.id,
            escalateToId: rule.escalateToId,
            newPriority: rule.newPriority,
            reason: `Milestone [${ms.milestoneType}] has breached its target time of ${ms.targetTime.toISOString()}`,
          };
        }
      }

      // 2. milestone_approaching evaluation
      if (rule.triggerType === "milestone_approaching") {
        if (ms.status === "pending" && !ms.completedAt) {
          const timeDiffMs = ms.targetTime.getTime() - currentTime.getTime();
          const thresholdMs = rule.timeThresholdMinutes * 60 * 1000;

          if (timeDiffMs > 0 && timeDiffMs <= thresholdMs) {
            return {
              ruleId: rule.id,
              escalateToId: rule.escalateToId,
              newPriority: rule.newPriority,
              reason: `Milestone [${ms.milestoneType}] is approaching breach (due in ${Math.round(timeDiffMs / 1000 / 60)} minutes)`,
            };
          }
        }
      }
    }
  }

  return null;
}
```

---

## 3. Database Store Updates (`packages/db/src/index.ts`)

We will add `ticketEscalationRules` and `ticketEscalations` to the mock `store` and database mapping functions.
- Update interfaces `DBTicketEscalationRule`, `DBTicketEscalation`.
- Add `ticketEscalationRules: [] as DBTicketEscalationRule[]` and `ticketEscalations: [] as DBTicketEscalation[]` to the in-memory mock `store` definition.
- Expose appropriate query helper mappings inside `dbStore`.
