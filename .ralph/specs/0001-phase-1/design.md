# Phase 1: Identity, Tenancy, & Security Foundation - Design

## Database Schema (Drizzle ORM)

We will define the following relational structures in `packages/db/src/schema.ts`:

* **`organizations`**
  * `id`: uuid (primary key)
  * `name`: text (non-nullable)
  * `status`: text (active, suspended, etc.)
  * `createdAt`: timestamp (default now)

* **`users`**
  * `id`: uuid (primary key)
  * `email`: text (unique, non-nullable)
  * `passwordHash`: text (non-nullable)
  * `status`: text (active, inactive)
  * `createdAt`: timestamp (default now)

* **`memberships`**
  * `id`: uuid (primary key)
  * `orgId`: uuid (foreign key referencing organizations.id)
  * `userId`: uuid (foreign key referencing users.id)
  * `roleId`: uuid (foreign key referencing roles.id)

* **`roles`**
  * `id`: uuid (primary key)
  * `orgId`: uuid (foreign key referencing organizations.id)
  * `name`: text (non-nullable)
  * `permissionsMask`: integer (bitmask representation)

## Tenant Context Parser Contract

In `packages/auth/src/index.ts`:
* Verify incoming session JWTs and return the resolved `tenantContext`:
```typescript
export interface TenantContext {
  userId: string;
  orgId: string;
  roleId: string;
  permissionsMask: number;
}
```

## Row-Level Security Middleware

In `packages/db/src/index.ts`:
* Wrapper to execute queries within an RLS transaction set to `app.current_org_id = currentOrgId`.
```typescript
import { sql } from "drizzle-orm";
import { pgDatabase } from "./connection";

export async function withTenant<T>(orgId: string, run: (db: typeof pgDatabase) => Promise<T>): Promise<T> {
  return await pgDatabase.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
    return await run(tx as any);
  });
}
```
