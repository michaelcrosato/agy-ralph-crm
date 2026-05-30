# TICKET008: Public defineObject() SDK for No-Code Custom Objects

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Implement the `defineObject()` SDK and API endpoints to allow dynamic creation of no-code custom objects under strict organization RLS isolation.
- **Context**: Enables dynamic entity definition and runtime records generation dynamically backed by JSONB storage without requiring SQL migrations.

---

## Scope

### In Scope
- Create database schemas in `packages/db/src/schema.ts` for:
  - `customEntityTypes`: columns `id`, `tenantId`, `name`, `fieldsJson` (fields metadata).
  - `customEntityRecords`: columns `id`, `tenantId`, `typeId`, `data` (JSONB).
- Implement `packages/metadata/src/defineObject.ts` (exporting the `defineObject(tenantId, spec)` SDK).
- Add dynamic REST routing under Hono `/api/custom/:typeName` to support CRUD operations on custom records.
- Enforce strict RLS isolation using tenant context and validate record payloads against Zod validation schemas compiled from `fieldsJson` properties (string, number, boolean, date, lookup, picklist, multi-picklist, rich-text).
- Add robust Vitest integration tests in `packages/testing/src/custom-objects.test.ts`.

### Out of Scope
- Dynamic schema creation or modifications using physical raw DDL migrations at runtime (use the shared custom tables instead).

---

## Steps to Execute
1. Define the Drizzle schemas for `customEntityTypes` and `customEntityRecords` in `packages/db/src/schema.ts` and verify build/migration paths.
2. Implement metadata registry utility in `packages/metadata/` to parse definitions and compile Zod validation schemas.
3. Add a fallback REST API router under `apps/api/src/routes/custom.ts` (mounted in `apps/api/src/index.ts`) for `/api/custom/:typeName` dynamic routes.
4. Enforce active tenant organization verification before allowing reads/writes.
5. Create comprehensive tests covering custom entity declaration, validation failure, happy path CRUD, and strict tenant separation.
6. Verify code format and lint compliance using `pnpm verify`.

---

## Acceptance Criteria
- [x] Users can dynamically define new objects (e.g. `Project`) and register fields.
- [x] Payload validation rejects invalid schema attributes cleanly.
- [x] CRUD operations `/api/custom/project` function correctly.
- [x] Strict multi-tenant organization boundaries are enforced with RLS.
- [x] Full Vitest suite is 100% green.

---

## Commands
```bash
npx vitest run packages/testing/src/custom-objects.test.ts
pnpm verify
```
