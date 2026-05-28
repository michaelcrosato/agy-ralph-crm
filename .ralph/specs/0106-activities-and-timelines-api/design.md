# Specification: Activities & Chronological Task Timelines REST API - Design

## Database Extension
We will add `activities` and `activityLinks` arrays to the `store` object inside `packages/db/src/index.ts`. We will expose their corresponding CRUD operations inside the `dbStore` object.

```typescript
export interface DBActivity {
  id: string;
  orgId: string;
  creatorId: string;
  type: "task" | "call" | "note" | "email";
  subject: string;
  body: string | null;
  dueDate: Date | null;
  createdAt: Date;
}

export interface DBActivityLink {
  id: string;
  orgId: string;
  activityId: string;
  targetType: "Account" | "Contact" | "Lead" | "Opportunity";
  targetId: string;
}
```

We will implement `findMany`, `findOne`, and `insert` for both `activities` and `activityLinks` namespaces under `dbStore`.

## API Routing Layout
Endpoints will be registered inside `apps/api/src/index.ts`:

- `POST /api/activities`
  - Accepts payload: `{ type: "task"|"call"|"note"|"email", subject: string, body?: string, dueDate?: string, links?: { targetType: string, targetId: string }[] }`.
  - Inserts activity and subsequent link records securely under the tenant's RLS session context.

- `GET /api/activities/:id`
  - Retrieves activity details, returning a 404 error if not found.

- `GET /api/activities/timeline/:targetType/:targetId`
  - Locates all `activityLinks` matching the specific record `targetType` and `targetId`.
  - Fetches the associated `activities` and returns them sorted by `createdAt` in descending order.
