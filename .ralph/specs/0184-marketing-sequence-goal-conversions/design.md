# Specification: Marketing Sequence Conversion Goals & Attribution Engine - Design

## 1. Database Schema

We introduce two new tables: `marketing_sequence_goals` and `marketing_sequence_conversions`.

```typescript
export const marketingSequenceGoals = pgTable("marketing_sequence_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => marketingSequences.id, { onDelete: "cascade" }),
  goalType: text("goal_type").notNull(), // "lead_status_equals" | "opportunity_created"
  targetValue: text("target_value"), // e.g. "Qualified"
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const marketingSequenceConversions = pgTable("marketing_sequence_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  membershipId: uuid("membership_id")
    .notNull()
    .references(() => marketingSequenceMemberships.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => marketingSequences.id, { onDelete: "cascade" }),
  goalId: uuid("goal_id")
    .notNull()
    .references(() => marketingSequenceGoals.id, { onDelete: "cascade" }),
  attributedRevenue: text("attributed_revenue").notNull().default("0.00"),
  convertedAt: timestamp("converted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

---

## 2. Core Logic Methods

We will define new core interfaces and methods inside `packages/core/src/index.ts`:

```typescript
export interface CoreSequenceGoal {
  id: string;
  orgId: string;
  sequenceId: string;
  goalType: string;
  targetValue: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoreSequenceConversion {
  id: string;
  orgId: string;
  membershipId: string;
  sequenceId: string;
  goalId: string;
  attributedRevenue: string;
  convertedAt: Date;
  createdAt: Date;
}
```

We will implement `evaluateSequenceGoals` to check memberships:
```typescript
export async function evaluateSequenceGoals(
  dbStore: any,
  orgId: string,
  membership: CoreSequenceMembership,
  recipientContext: { lead?: any; contact?: any },
): Promise<boolean> {
  const goals = await dbStore.marketingSequenceGoals.findForSequence(membership.sequenceId);
  const activeGoals = goals.filter((g: any) => g.isActive === 1);
  if (activeGoals.length === 0) return false;

  for (const goal of activeGoals) {
    let achieved = false;
    let revenue = "0.00";

    if (goal.goalType === "lead_status_equals" && membership.recordType === "lead" && recipientContext.lead) {
      if (recipientContext.lead.status === goal.targetValue) {
        achieved = true;
      }
    } else if (goal.goalType === "opportunity_created") {
      const allOpps = await dbStore.opportunities.findMany();
      let relevantOpps: any[] = [];
      if (membership.recordType === "lead") {
        relevantOpps = allOpps.filter((opp: any) => opp.custom?.sourceLeadId === membership.recordId);
      } else if (membership.recordType === "contact" && recipientContext.contact) {
        const contactAccountId = recipientContext.contact.accountId;
        if (contactAccountId) {
          relevantOpps = allOpps.filter((opp: any) => opp.accountId === contactAccountId);
        }
      }

      if (relevantOpps.length > 0) {
        achieved = true;
        const totalAmt = relevantOpps.reduce((sum: number, opp: any) => {
          const amt = Number.parseFloat(opp.amount || "0.00");
          return sum + (Number.isNaN(amt) ? 0 : amt);
        }, 0);
        revenue = totalAmt.toFixed(2);
      }
    }

    if (achieved) {
      // Mark converted
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "converted",
      });

      // Insert conversion log
      await dbStore.marketingSequenceConversions.insert({
        orgId,
        membershipId: membership.id,
        sequenceId: membership.sequenceId,
        goalId: goal.id,
        attributedRevenue: revenue,
        convertedAt: new Date(),
      });

      // Insert Audit Log
      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "goal_conversion",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          status: { before: membership.status, after: "converted" },
          attributedRevenue: { before: null, after: revenue },
        },
      });

      return true;
    }
  }

  return false;
}
```

---

## 3. RLS Tenant Rules

Each database query executed by the REST API and integration tests will strictly authenticate using the tenant `org_id` context mapping via the standard store interface `withTenant`.
- `marketing_sequence_goals` and `marketing_sequence_conversions` stores will enforce tenant isolation automatically in `packages/db`.
