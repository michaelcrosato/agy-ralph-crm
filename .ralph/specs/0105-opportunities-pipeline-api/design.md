# Specification: Opportunities Pipeline & Stage Management REST API - Design

## Database & Store Changes
The `dbStore.opportunities` namespace currently lacks an `update` method. We will add an `update` method in `packages/db/src/index.ts` modeled after `dbStore.leads.update` to securely update opportunity fields under strict RLS context checks.

```typescript
update: async (
  id: string,
  updates: Partial<Omit<DBOpportunity, "id" | "orgId">>,
) => {
  const orgId = getActiveOrgId();
  const index = store.opportunities.findIndex((o) => o.id === id);
  if (index === -1) return null;
  if (store.opportunities[index].orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  store.opportunities[index] = { ...store.opportunities[index], ...updates };
  return store.opportunities[index];
}
```

## API Routing Layout
Endpoints to be defined in `apps/api/src/index.ts`:

- `GET /api/opportunities`
  - Fetches all opportunities for the active tenant using `dbStore.opportunities.findMany()`.
  - Returns: `{ success: true, data: DBOpportunity[] }`

- `GET /api/opportunities/:id`
  - Fetches a single opportunity using `dbStore.opportunities.findOne(id)`.
  - Returns: `{ success: true, data: DBOpportunity }` or `404` if not found.

- `POST /api/opportunities`
  - Creates a new opportunity under the active tenant using `dbStore.opportunities.insert(...)`.
  - Requires parameters: `name`, `stage`, `accountId`.
  - Returns: `{ success: true, data: DBOpportunity }`

- `PATCH /api/opportunities/:id`
  - Updates opportunity fields under the active tenant using `dbStore.opportunities.update(...)`.
  - If the `stage` field is updated and changed from its existing value, it automatically executes Hono route-level workflows matching the `opportunity.stage_changed` trigger event using `@crm/workflow`'s `executeWorkflows`.
  - Returns: `{ success: true, data: DBOpportunity, workflow?: any }` or `404` if not found.
