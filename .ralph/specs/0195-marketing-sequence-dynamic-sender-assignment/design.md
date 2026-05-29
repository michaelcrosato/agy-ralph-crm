# Specification: Marketing Sequence Dynamic Sender Assignment - Design

## 1. Relational Database Additions (`packages/db/src/schema.ts`)

We will update the Drizzle table `marketingSequences`:

```typescript
export const marketingSequences = pgTable("marketing_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  sendingWindowStart: text("sending_window_start"),
  sendingWindowEnd: text("sending_window_end"),
  sendingDays: jsonb("sending_days"),
  allowReenrollment: boolean("allow_reenrollment").notNull().default(false),
  reenrollmentMinDays: integer("reenrollment_min_days"),
  dailySendLimit: integer("daily_send_limit"),
  senderType: text("sender_type").notNull().default("system"),
  senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

We will also update `packages/db/src/index.ts` to:
- Update typescript interface `DBMarketingSequence` to include `senderType` and `senderUserId`.
- Ensure mock in-memory operations in `marketingSequences` CRUD support the new columns.

## 2. Core Worker Loop Upgrades (`packages/core/src/index.ts`)

Inside `executePendingSequenceSteps`, when executing a step for a membership:
- Fetch the sequence object: `const sequence = await dbStore.marketingSequences.findOne(membership.sequenceId);`
- Resolve sender user ID:
  ```typescript
  let resolvedSenderId = "00000000-0000-0000-0000-000000000000";
  if (sequence) {
    const senderType = sequence.senderType || "system";
    if (senderType === "owner") {
      let recipient: any = null;
      if (membership.recordType === "lead" && dbStore.leads) {
        recipient = await dbStore.leads.findOne(membership.recordId);
      } else if (membership.recordType === "contact" && dbStore.contacts) {
        recipient = await dbStore.contacts.findOne(membership.recordId);
      }
      if (recipient && recipient.ownerId) {
        resolvedSenderId = recipient.ownerId;
      }
    } else if (senderType === "specific" && sequence.senderUserId) {
      resolvedSenderId = sequence.senderUserId;
    }
  }
  ```
- Assign this resolved sender to `creatorId` during activity insert:
  ```typescript
  const activity = await dbStore.activities.insert({
    orgId,
    creatorId: resolvedSenderId,
    type: "email",
    subject: compiled.subject,
    body: compiled.body,
    dueDate: null,
    createdAt: currentTime,
  });
  ```

## 3. Hono REST Endpoints (`apps/api/src/index.ts`)

We will update sequence endpoints:
- **POST `/api/sequences`**: Add validation for `senderType` and `senderUserId`. If `senderType` is `"specific"`, verify that `senderUserId` is a valid user inside the active organization.
- **PATCH `/api/sequences/:id`**: Create this endpoint to handle partial updates. Implement standard RLS validations matching other update operations (verify the sequence belongs to the active tenant organization).
