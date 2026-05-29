# Specification: Marketing Sequences & Drip Journeys API - Design

## 1. Schema Extensions & Interfaces

We declare the new entities in `packages/db/src/schema.ts` and `packages/db/src/index.ts`:

### Postgres / Drizzle Schema (`packages/db/src/schema.ts`)
```typescript
export const marketingSequences = pgTable("marketing_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const marketingSequenceSteps = pgTable("marketing_sequence_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id").notNull().references(() => marketingSequences.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  delayDays: integer("delay_days").notNull().default(0),
  templateId: uuid("template_id").notNull().references(() => emailTemplates.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const marketingSequenceMemberships = pgTable("marketing_sequence_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id").notNull().references(() => marketingSequences.id, { onDelete: "cascade" }),
  recordType: text("record_type").notNull(), // "lead" | "contact"
  recordId: uuid("record_id").notNull(),
  status: text("status").notNull().default("active"), // "active" | "completed" | "unsubscribed" | "error"
  currentStepNumber: integer("current_step_number").notNull().default(0),
  lastExecutedAt: timestamp("last_executed_at"),
  nextExecutionAt: timestamp("next_execution_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### In-Memory Interfaces (`packages/db/src/index.ts`)
We expose local typings `DBMarketingSequence`, `DBMarketingSequenceStep`, and `DBMarketingSequenceMembership`, matching properties exactly.
We mount `marketingSequences`, `marketingSequenceSteps`, and `marketingSequenceMemberships` in the internal `store` array and build RLS-isolated CRUD interfaces on `dbStore`.

## 2. API Endpoints

### 2.1 Sequences Administration
- **POST `/api/sequences`**
  - Payload: `{ name, description, status }`
  - Saves a sequence record.
- **POST `/api/sequences/:id/steps`**
  - Payload: `{ stepNumber, delayDays, templateId }`
  - Saves a sequence step.
- **GET `/api/sequences/:id/members`**
  - Returns the list of enrolled memberships and progress.

### 2.2 Sequence Enrollment
- **POST `/api/sequences/:id/enroll`**
  - Payload: `{ recordType: "lead" | "contact", recordId: string }`
  - Inserts active membership. Finds the first sequence step (step number 1). Calculates `nextExecutionAt` as current time plus first step's `delayDays`.

### 2.3 Journeys Execution
- **POST `/api/sequences/execute`**
  - Handler Logic:
    1. Query all active `marketing_sequence_memberships` in the database where `nextExecutionAt` <= current time.
    2. For each membership, wrap within tenant context (`withTenant`):
       - Check `contact_consent_preferences` for matching `recordType`/`recordId` with `email` and `opt_out`.
       - If opted out, update membership status to `unsubscribed` and update audit logs.
       - Fetch `marketing_sequence_steps` matching `sequenceId` and `stepNumber` = `currentStepNumber + 1`.
       - If no next step found, set status to `completed`.
       - Else, load `email_templates` matching `templateId`.
       - Resolve dynamic placeholders (e.g. `{{firstName}}`, `{{lastName}}`, `{{company}}`) by querying Lead or Contact details.
       - Insert a new `activity` (type: `"email"`, subject and body compiled).
       - Insert `activity_links` linking to Lead or Contact.
       - Increment `currentStepNumber` by 1.
       - Check if there is another step (e.g. `currentStepNumber + 1`).
       - If yes, compute next `nextExecutionAt` as current time plus next step's `delayDays` (converted to milliseconds or mock hours for fast-testing). For testing simplicity, `delayDays` will represent immediate delay or seconds.
       - Update membership progress.
