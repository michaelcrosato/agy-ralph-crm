# Specification: Marketing Sequence Email Open Triggers - Design

## 1. Database Schema Design
We will introduce a new table `marketingSequenceOpenActions` (`marketing_sequence_open_actions`) in `packages/db/src/schema.ts`:

```typescript
export const marketingSequenceOpenActions = pgTable(
  "marketing_sequence_open_actions",
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

## 2. API Endpoints
We will expose the following REST endpoints in `apps/api/src/index.ts`:

- `GET /api/sequences/steps/:stepId/open-actions`: Returns all open actions for a given step under the active organization.
- `POST /api/sequences/steps/:stepId/open-actions`: Creates a new open action for a given step.
- `DELETE /api/sequences/steps/open-actions/:id`: Deletes an open action.

## 3. Open Triggers Evaluation Logic
When a client hits `GET /api/public/emails/track/open/:token`:
1. Find `emailTrackers` record by `token`.
2. Update the `openCount` and `lastOpenedAt` fields on the tracker.
3. Record an audit log entry for the email tracker open event.
4. If the tracker's `activityId` is linked to a Lead or Contact:
   - Load the recipient's `marketingSequenceMemberships` record.
   - Sort the recipient's sequence email activities by ID to identify the step number.
   - Load the corresponding `marketingSequenceSteps` record.
   - Query all `marketingSequenceOpenActions` for this `stepId`.
   - Iterate and execute each action (either `field_update` or `create_task`) and log the appropriate audit trails.
