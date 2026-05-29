# Task 0165: Database Migration & Rollback Engine - Requirements

## Functional Requirements

1. **Migration Registry**:
   - Provide a programmatic structure to define and register database migrations.
   - Each migration must have a unique `version: number` (sequential integer), `name: string`, `up(store: any): Promise<void>` (upgrade logic), and `down(store: any): Promise<void>` (rollback logic).

2. **Applied Migration Tracking**:
   - Save applied migrations in a tracking table `schema_migrations` with columns: `id`, `version`, `name`, `appliedAt`.
   - Expose queries to fetch the current version and applied history.

3. **Execution Mode (Up)**:
   - Run migrations sequentially from the current version up to the latest registered migration or a specified `targetVersion`.
   - Ensure a migration is not applied twice.
   - Run under database transaction boundaries.

4. **Rollback Mode (Down)**:
   - Roll back migrations in reverse chronological order from the current version down to a specified `targetVersion`.
   - Execute the `down` function of each rolled back migration to restore data/schema.
   - Remove rolled-back records from the `schema_migrations` store.

5. **Multi-Tenant / RLS Enforcement**:
   - Allow migrations to be run or rolled back under strict tenant context checks or admin bypass boundaries.
   - Prevent cross-tenant data leakages during custom migration transformations.

6. **API Endpoints**:
   - `POST /api/db/migrate`: Run all pending migrations. Accept optional `{ targetVersion?: number }` parameter.
   - `POST /api/db/rollback`: Roll back migrations. Accept required `{ targetVersion: number }` parameter.
   - `GET /api/db/migrations`: Query currently applied migrations history.
