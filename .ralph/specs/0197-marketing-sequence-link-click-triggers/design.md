# Specification: Marketing Sequence Link Click Triggers - Design

## 1. Database Schema Definitions

### 1.1 `marketing_sequence_link_actions` Table
Add to `packages/db/src/schema.ts` and mock `store` in `packages/db/src/index.ts`:

```typescript
export const marketingSequenceLinkActions = pgTable(
  "marketing_sequence_link_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    targetUrl: text("target_url").notNull(), // The URL to match or "*"
    actionType: text("action_type").notNull(), // "field_update" | "create_task"
    actionConfig: jsonb("action_config").notNull(), // config options
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);
```

## 2. Core Business Logic

### 2.1 Click Actions Processor
Implement `processSequenceLinkClick` in `packages/core/src/index.ts`:

```typescript
export async function processSequenceLinkClick(
  dbStore: any,
  orgId: string,
  activityId: string,
  clickedUrl: string,
  currentTime: Date = new Date()
): Promise<number>
```
Steps inside `processSequenceLinkClick`:
1. Find `activityLinks` where `activityId` matches, to locate the recipient record (Lead/Contact).
2. Find `marketingSequenceMemberships` for this record within `orgId`.
3. If no active membership is found, exit.
4. Fetch all activities for this recipient, filter by `email` and sort by ID.
5. Locate the clicked `activityId` in that list to determine the step number (index + 1).
6. Find the `marketingSequenceSteps` record matching `sequenceId` and `stepNumber` from the membership.
7. Query all `marketingSequenceLinkActions` for this `stepId` and filter where `targetUrl` is equal to `clickedUrl` or `*`.
8. Execute each matched action:
   - For `field_update`: Update the lead or contact record's specified field or custom property.
   - For `create_task`: Insert a new `task` activity and link it to the recipient.
9. Log an audit event.

## 3. REST API Gateways

### 3.1 Link Actions Endpoints
Expose in `apps/api/src/index.ts`:
- `GET /api/sequences/steps/:stepId/link-actions`: Fetch link actions for a step.
- `POST /api/sequences/steps/:stepId/link-actions`: Create a link action.
- `DELETE /api/sequences/steps/link-actions/:id`: Delete a link action.

### 3.2 Update Click Tracking Route
Update `GET /api/public/emails/track/click/:token` in `apps/api/src/index.ts` to invoke `processSequenceLinkClick`.
