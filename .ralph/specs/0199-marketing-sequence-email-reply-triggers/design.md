# Specification: Marketing Sequence Email Reply Triggers - Design

## 1. Database Schema Design
We will introduce a new table `marketingSequenceReplyActions` (`marketing_sequence_reply_actions`) in `packages/db/src/schema.ts`:

```typescript
export const marketingSequenceReplyActions = pgTable(
  "marketing_sequence_reply_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(), // 'field_update' | 'create_task'
    actionConfig: jsonb("action_config").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);
```

We will also update `emailTrackers` schema inside `packages/db/src/schema.ts` to include:
```typescript
  replyCount: integer("reply_count").notNull().default(0),
  lastRepliedAt: timestamp("last_replied_at"),
```

And mirror these changes in `packages/db/src/index.ts`.

## 2. API Endpoints
We will expose the following REST endpoints in `apps/api/src/index.ts`:

- `GET /api/sequences/steps/:stepId/reply-actions`: Returns all reply actions for a given step under the active organization.
- `POST /api/sequences/steps/:stepId/reply-actions`: Creates a new reply action for a given step.
- `DELETE /api/sequences/steps/reply-actions/:id`: Deletes a reply action.
- `POST /api/public/emails/track/reply/:token`: Public endpoint simulating an incoming email reply event.

## 3. Reply Triggers Evaluation Logic
When a client hits `POST /api/public/emails/track/reply/:token`:
1. Find `emailTrackers` record by `token`.
2. Update the `replyCount` and `lastRepliedAt` fields on the tracker.
3. Record an audit log entry for the email tracker reply event.
4. If the tracker's `activityId` is linked to a Lead or Contact:
   - Load the recipient's `marketingSequenceMemberships` record.
   - Transition the membership status to `completed`.
   - Log the auto-completion of the membership.
   - Sort the recipient's sequence email activities by ID to identify the step number.
   - Load the corresponding `marketingSequenceSteps` record.
   - Query all `marketingSequenceReplyActions` for this `stepId`.
   - Iterate and execute each action (either `field_update` or `create_task`) and log the appropriate audit trails.
