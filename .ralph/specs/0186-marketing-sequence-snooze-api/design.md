# Specification: Marketing Sequence Member Snooze & Resume Engine - Design

## 1. Database Schema

We will add the following two fields to the `marketingSequenceMemberships` table inside `packages/db/src/schema.ts`:

- `snoozeUntil`: `timestamp("snooze_until")` (nullable)
- `snoozeReason`: `text("snooze_reason")` (nullable)

```typescript
export const marketingSequenceMemberships = pgTable(
  "marketing_sequence_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => marketingSequences.id, { onDelete: "cascade" }),
    recordType: text("record_type").notNull(), // "lead" | "contact"
    recordId: uuid("record_id").notNull(),
    status: text("status").notNull().default("active"), // "active" | "completed" | "unsubscribed" | "error" | "suppressed" | "snoozed"
    currentStepNumber: integer("current_step_number").notNull().default(0),
    lastExecutedAt: timestamp("last_executed_at"),
    nextExecutionAt: timestamp("next_execution_at").notNull().defaultNow(),
    snoozeUntil: timestamp("snooze_until"),
    snoozeReason: text("snooze_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);
```

We must also update interfaces:
- `DBMarketingSequenceMembership` in `packages/db/src/index.ts`
- `CoreSequenceMembership` in `packages/core/src/index.ts`

```typescript
export interface DBMarketingSequenceMembership {
  id: string;
  orgId: string;
  sequenceId: string;
  recordType: "lead" | "contact";
  recordId: string;
  status: string;
  currentStepNumber: number;
  lastExecutedAt: Date | null;
  nextExecutionAt: Date;
  snoozeUntil: Date | null;
  snoozeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 2. Core Business Logic

Inside `packages/core/src/index.ts`, update `executePendingSequenceSteps` to process automatic resumptions at the very start:

```typescript
// 1. Process Auto-Resumptions for Snoozed Memberships
const allMembershipsForAutoResume = await dbStore.marketingSequenceMemberships.findMany();
for (const m of allMembershipsForAutoResume) {
  if (
    m.status === "snoozed" &&
    m.snoozeUntil &&
    new Date(m.snoozeUntil) <= currentTime
  ) {
    await dbStore.marketingSequenceMemberships.update(m.id, {
      status: "active",
      snoozeUntil: null,
      nextExecutionAt: currentTime,
    });

    await dbStore.auditLogs.insert({
      orgId: m.orgId,
      recordId: m.id,
      recordType: "marketing_sequence_memberships",
      action: "membership_resumed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: "snoozed", after: "active" },
        snoozeUntil: { before: m.snoozeUntil.toISOString(), after: null },
      },
    });
  }
}
```

Ensure the pending membership filtration remains robust, only picking up `"active"` memberships:
```typescript
const pendingMemberships = memberships.filter(
  (m) => m.status === "active" && new Date(m.nextExecutionAt) <= currentTime,
);
```

---

## 3. REST API Routing Plan

Inside `apps/api/src/index.ts`, implement the following routes:

### 3.1 `POST /api/sequences/memberships/:membershipId/snooze`
- Verifies membership exists and belongs to the current tenant orgId.
- Parses `snoozeUntil` and optional `reason`.
- Calls `dbStore.marketingSequenceMemberships.update` with status `"snoozed"`, `snoozeUntil`, and `snoozeReason`.
- Writes `"membership_snoozed"` audit trail entry.
- Returns `200 OK` with success and the updated membership data.

### 3.2 `POST /api/sequences/memberships/:membershipId/resume`
- Verifies membership exists and belongs to the current tenant orgId.
- Calls `dbStore.marketingSequenceMemberships.update` with status `"active"`, `snoozeUntil: null`, `snoozeReason: null`, and `nextExecutionAt: new Date()`.
- Writes `"membership_resumed"` audit trail entry.
- Returns `200 OK` with success and the updated membership data.
