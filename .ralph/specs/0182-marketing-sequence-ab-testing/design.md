# Specification: Marketing Sequence A/B Split Testing Engine - Design

## 1. Schema Additions (`packages/db/src/schema.ts`)

We will add two new tables:

```typescript
export const marketingSequenceStepSplitTests = pgTable(
  "marketing_sequence_step_split_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    variantTemplateId: uuid("variant_template_id")
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "cascade" }),
    splitWeight: integer("split_weight").notNull().default(50), // split weight for variant B (e.g. 50%)
    isActive: integer("is_active").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const marketingSequenceAbAllocations = pgTable(
  "marketing_sequence_ab_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => marketingSequenceMemberships.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    allocatedTemplateId: uuid("allocated_template_id")
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
);
```

## 2. Core Business Logic (`packages/core/src/index.ts`)
We will update `executePendingSequenceSteps` in `packages/core/src/index.ts` to support split test routing.
If `dbStore.marketingSequenceStepSplitTests` and `dbStore.marketingSequenceAbAllocations` are defined, we check if there is an active split test on the current step.
If active, we fetch existing allocations for the member and step.
If none exists, we draw a random number <= `splitWeight` to select the variant template (B), else the step's default template (A), and insert the allocation.
Finally, we dispatch the selected template.

## 3. REST API Routes (`apps/api/src/index.ts`)
- `GET /api/sequences/:id/steps/:stepId/split-test`
- `POST /api/sequences/:id/steps/:stepId/split-test`
- `POST /api/sequences/:id/steps/:stepId/split-test/allocate`
