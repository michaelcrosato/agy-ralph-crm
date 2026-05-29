# Task 0165: Database Migration & Rollback Engine - Design

## Database Schema Modifications

Add `schemaMigrations` table definition to `packages/db/src/schema.ts` and in-memory mock store interfaces:

```typescript
export const schemaMigrations = pgTable("schema_migrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: integer("version").notNull().unique(),
  name: text("name").notNull(),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
});
```

Mock Database interface in `packages/db/src/index.ts` must export `schemaMigrations` CRUD methods.

## Migration Contracts in `packages/core`

```typescript
export interface DBStoreMigration {
  version: number;
  name: string;
  up: (dbStore: any) => Promise<void>;
  down: (dbStore: any) => Promise<void>;
}
```

Implement the core migration runner:

```typescript
export const registeredMigrations: DBStoreMigration[] = [
  {
    version: 1,
    name: "Initialize Default Webhook Status",
    up: async (db) => {
      // Logic to update all webhooks with empty status to "active"
      const webhooks = await db.webhooks.findMany();
      for (const w of webhooks) {
        if (!w.status) w.status = "active";
      }
    },
    down: async (db) => {
      const webhooks = await db.webhooks.findMany();
      for (const w of webhooks) {
        if (w.status === "active") w.status = "";
      }
    }
  }
];
```

Functions to expose:
- `runStoreMigrations(dbStore: any, targetVersion?: number): Promise<{ success: boolean; applied: number[]; currentVersion: number }>`
- `rollbackStoreMigrations(dbStore: any, targetVersion: number): Promise<{ success: boolean; rolledBack: number[]; currentVersion: number }>`

## REST API Endpoints

- **`GET /api/db/migrations`**
  Response: `{ success: true, migrations: DBSchemaMigration[] }`

- **`POST /api/db/migrate`**
  Payload: `{ targetVersion?: number }`
  Response: `{ success: true, applied: number[], currentVersion: number }`

- **`POST /api/db/rollback`**
  Payload: `{ targetVersion: number }`
  Response: `{ success: true, rolledBack: number[], currentVersion: number }`
