# Spec 0127: Opportunity Contact Roles API Design

## Pure Core Functions (`packages/core/src/index.ts`)

### Types
```typescript
export interface DBOpportunityContactRole {
  id: string;
  orgId: string;
  opportunityId: string;
  contactId: string;
  role: string;
  isPrimary: boolean;
}
```

### Signature: `setPrimaryOpportunityContactRole`
```typescript
export function setPrimaryOpportunityContactRole(
  roles: DBOpportunityContactRole[],
  opportunityId: string,
  primaryContactId: string,
): DBOpportunityContactRole[]
```
* **Algorithm**:
  - Map over the array of roles.
  - If a role belongs to the target `opportunityId`, update its `isPrimary` field to `true` if its `contactId` matches `primaryContactId`, and `false` otherwise.
  - Return the updated roles array.

## Database Schema & Store Expansion (`packages/db/src/index.ts`)

### Store Schema addition
* Add `opportunityContactRoles` array to the global in-memory `store`:
  ```typescript
  opportunityContactRoles: [] as DBOpportunityContactRole[]
  ```
* Add `opportunityContactRoles` to `dbStore` with standard active org RLS tenant isolation checks:
  ```typescript
  opportunityContactRoles: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityContactRoles.filter((r) => r.orgId === orgId);
    },
    findForOpportunity: async (opportunityId: string) => {
      const orgId = getActiveOrgId();
      return store.opportunityContactRoles.filter(
        (r) => r.opportunityId === opportunityId && r.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const r = store.opportunityContactRoles.find((x) => x.id === id);
      if (r && r.orgId !== orgId) return null;
      return r || null;
    },
    insert: async (role: Omit<DBOpportunityContactRole, "id">) => {
      const orgId = getActiveOrgId();
      if (role.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRole: DBOpportunityContactRole = {
        ...role,
        id: `ocr-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.opportunityContactRoles.push(newRole);
      return newRole;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBOpportunityContactRole, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityContactRoles.findIndex((r) => r.id === id);
      if (index === -1) return null;
      if (store.opportunityContactRoles[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityContactRoles[index] = {
        ...store.opportunityContactRoles[index],
        ...updates,
      };
      return store.opportunityContactRoles[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityContactRoles.findIndex((r) => r.id === id);
      if (index === -1) return false;
      if (store.opportunityContactRoles[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityContactRoles.splice(index, 1);
      return true;
    },
  }
  ```

## REST API Endpoint Routing (`apps/api/src/index.ts`)

### `GET /api/opportunities/:id/contact-roles`
* Retrieve roles via `dbStore.opportunityContactRoles.findForOpportunity(opportunityId)`.
* Filter / match under RLS context and return roles array.

### `POST /api/opportunities/:id/contact-roles`
* Body: `{ contactId: string, role: string, isPrimary?: boolean }`
* Validate opportunity and contact exist in active org.
* Check if assignment already exists. If yes, return `400 Bad Request`.
* If `isPrimary` is `true`, find any other primary contacts on the opportunity and update them to `isPrimary = false`.
* Insert new contact role.
* Log `create` audit log.
* Trigger `opportunity.contact_role.created` webhook.

### `PUT /api/opportunities/:id/contact-roles/:roleId`
* Body: `{ role?: string, isPrimary?: boolean }`
* Retrieve role. If not found or org mismatch, return `404`.
* If `isPrimary` is updated to `true`, demote any other primary contacts on the opportunity.
* Update role assignment.
* Log `update` audit log.
* Trigger `opportunity.contact_role.updated` webhook.

### `DELETE /api/opportunities/:id/contact-roles/:roleId`
* Retrieve role. If not found or org mismatch, return `404`.
* Delete role assignment.
* Log `delete` audit log.
* Trigger `opportunity.contact_role.deleted` webhook.
