# Specification: Marketing Sequence Email Unsubscribe Reasons - Design

## 1. Database Schema Design
We will introduce a new table `emailUnsubscribes` (`email_unsubscribes`) in `packages/db/src/schema.ts` and export it:

```typescript
export const emailUnsubscribes = pgTable("email_unsubscribes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

We will also update `packages/db/src/index.ts` to include the `emailUnsubscribes` table within the in-memory db store simulation and define its types.

## 2. Endpoints & Controller Logic

### 2.1 Public Endpoint (`POST /api/public/emails/unsubscribe/:token/reason`)
Expose a new public endpoint in `apps/api/src/index.ts`:
1. Look up `emailTrackers` by the unsubscribe `token`. If not found, return `404 Not Found`.
2. Extract the JSON body containing `reason` (must validate against predefined values `"frequency"`, `"relevance"`, `"not_requested"`, `"other"`) and `feedback`.
3. Wrap insertion inside the `withTenant` context block for the tracker's `orgId`.
4. Insert a record into `dbStore.emailUnsubscribes` and return success.

### 2.2 Retrieval Endpoint (`GET /api/emails/unsubscribes`)
Expose a new endpoint in `apps/api/src/index.ts`:
1. Protect the endpoint with `tenantAuth` middleware context to enforce active tenant isolation.
2. Query `dbStore.emailUnsubscribes` and filter records matching the user's active `orgId`.
3. Sort results chronologically descending by `createdAt`.
4. Return results as a JSON array under `"data"`.
