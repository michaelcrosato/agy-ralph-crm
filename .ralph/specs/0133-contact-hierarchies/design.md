# Spec 0133: Contact Hierarchies & Organizational Org Charts Design

## 1. Database Schema
We will update the `contacts` table definition in `packages/db/src/schema.ts` to add the self-referencing relationship:

```typescript
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  custom: jsonb("custom"),
  reportsToId: uuid("reports_to_id").references(
    (): AnyPgColumn => contacts.id,
    { onDelete: "set null" },
  ),
});
```

## 2. Core Business Logic (`packages/core`)
We will implement `detectCircularContactRelation` in `packages/core/src/index.ts`:

```typescript
export interface SimpleContactRelation {
  id: string;
  reportsToId?: string | null;
}

export function detectCircularContactRelation(
  contactsList: SimpleContactRelation[],
  targetId: string,
  proposedReportsToId: string,
): boolean {
  if (targetId === proposedReportsToId) return true;

  const reportsToMap = new Map<string, string | null>();
  for (const c of contactsList) {
    reportsToMap.set(c.id, c.reportsToId || null);
  }

  reportsToMap.set(targetId, proposedReportsToId);

  let currentId: string | null = proposedReportsToId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);

    if (currentId === targetId) {
      return true;
    }

    currentId = reportsToMap.get(currentId) || null;
  }

  return false;
}
```

## 3. API Routing Endpoints (`apps/api`)
We will implement two new routes:
- **GET `/api/contacts/:id/hierarchy`**
  - Path: `/api/contacts/:id/hierarchy`
  - Auth: `tenantAuth`
  - Action: Fetch all contacts for the tenant, build the `parentPath` up to the root, and fetch immediate `directReports`.
- **PATCH `/api/contacts/:id`**
  - Path: `/api/contacts/:id`
  - Auth: `tenantAuth`
  - Action: If `reportsToId` is provided in the request body, validate that it belongs to the same tenant, run `detectCircularContactRelation` to verify no cycle is introduced, and update the record. Log audit trail and dispatch `contact.hierarchy_updated` webhook event.
