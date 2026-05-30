# 046 — Dynamic Custom Objects: Database, REST, and Dynamic MCP Integration

**Phase:** 2 (Replenish) · **Priority:** High · **Status:** `[~] In Progress` · **Depends on:** 031, 011, 014, 030

## Description & Expected Impact

Twenty CRM's primary architectural differentiator is its metadata-first Custom Objects engine, enabling users to create dynamic tables (e.g. `Project`, `Subscription`) without coding. 

While Spec 031 established the SDK core (`defineObject()` and `CustomObjectRegistry`), it deferred the persistence, dynamic REST endpoints, and automated Model Context Protocol (MCP) tool routing layers. This specification realizes the complete full-stack integration:
1. **Schema & Stores**: Real database storage via `custom_entity_types` and `custom_entity_records` tables with tenant RLS and composite indexes.
2. **REST Endpoints**: Dynamic CRUD API router mounted at `/api/custom/:typeName` validating record inputs against runtime-compiled Zod schemas.
3. **Dynamic MCP Tools**: The MCP server dynamically reads registered custom object types and automatically registers native tools (e.g. `crm_create_project`, `crm_get_project`) with the Model Context Protocol, mirroring Twenty's advanced metadata-driven architecture.

## Definition of Done & Acceptance Criteria

- [ ] **Database Schema (`packages/db/src/schema.ts`)**:
  - Declare `customEntityTypes` table with columns: `id`, `orgId` (referencing `organizations.id`), `name` (unique per tenant), and `fieldsJson` (JSONB list of `CustomFieldSpec`).
  - Declare `customEntityRecords` table with columns: `id`, `orgId`, `typeId` (referencing `customEntityTypes.id`), `data` (JSONB fields data), `createdAt`, and `updatedAt`.
  - Add composite performance indexes on both tables.
- [ ] **Mock Stores & PG Factories (`packages/db/src/`)**:
  - Implement in-memory mock stores in `packages/db/src/stores/customEntityTypes.ts` and `customEntityRecords.ts`, registering them in `mockStores` and `store`.
  - Register the tables inside `storeMetadata` in `pg-factory.ts` to allow automatic Drizzle/PG operations under the `"pg"` driver.
- [ ] **REST CRUD Router (`apps/api/src/routes/custom.ts`)**:
  - Add `/api/custom/:typeName` endpoints:
    - `POST /api/custom/:typeName` — Validates the input payload against the registered Zod schema for `typeName`, saving the record.
    - `GET /api/custom/:typeName` — Lists all records of the given typeName.
    - `GET /api/custom/:typeName/:id` — Retrieves a single custom record.
    - `PATCH /api/custom/:typeName/:id` — Patches the custom record, validating the updated payload against the Zod schema.
    - `DELETE /api/custom/:typeName/:id` — Deletes the custom record.
  - Enforce strict RLS organization context isolation across all dynamic routes.
- [ ] **Dynamic MCP Tools (`packages/mcp/src/index.ts`)**:
  - The MCP server must query `dbStore.customEntityTypes.findMany()` (filtered by the active `orgId` tenant context) to dynamically fetch all custom object registrations.
  - For each registered custom object (e.g., `project`), dynamically register the following MCP tools in `ListToolsRequestSchema`:
    - `crm_get_<objectName>`
    - `crm_list_<objectName>`
    - `crm_create_<objectName>`
    - `crm_update_<objectName>`
    - `crm_delete_<objectName>`
  - Implement corresponding execution pathways in `CallToolRequestSchema` that route requests directly to the dynamic database layers.
- [ ] **Integration Tests (`packages/testing/src/custom-objects-full-stack.test.ts`)**:
  - Assert end-to-end CRUD capability for custom objects via both Hono REST endpoints and dynamic MCP tool execution calls.
  - Assert strict multi-tenant RLS isolation: tenant A cannot query or alter tenant B's custom records.

## Implementation Approach

1. **Schema and Store Wiring**:
   - Update `packages/db/src/schema.ts` to export `customEntityTypes` and `customEntityRecords`.
   - Update `packages/db/src/_store.ts` to include `customEntityTypes` and `customEntityRecords` types and store arrays.
   - Create store files `packages/db/src/stores/customEntityTypes.ts` and `customEntityRecords.ts`.
   - Update `packages/db/src/stores/index.ts` to expose them.
   - Register them in `pg-factory.ts` under `storeMetadata`.
2. **REST API**:
   - Create `apps/api/src/routes/custom.ts` using the Hono framework.
   - Read custom object spec via `dbStore.customEntityTypes` and compile Zod record validator using `@crm/metadata` `defineObject` core.
   - Mount this router in the main API server (`apps/api/src/index.ts`).
3. **MCP Server**:
   - Extend `packages/mcp/src/index.ts` to fetch dynamic types inside the `ListToolsRequestSchema` and `CallToolRequestSchema` handlers.
4. **Validation**:
   - Run workspace typecheck, lint checks, and Vitest suite verifications.

## Test Strategy

- **Integration Test Suite**: `packages/testing/src/custom-objects-full-stack.test.ts`
  - Register a mock custom object `Project` for `org-a`.
  - Verify REST endpoints `/api/custom/project` for creating, updating, listing, and deleting records.
  - Verify that `org-b` cannot read `/api/custom/project`.
  - Verify MCP tools `crm_create_project`, `crm_list_project`, etc., are dynamically listed and callable with full tenant RLS safety.

## Rollback

```bash
git restore packages/db/src/schema.ts packages/db/src/stores/index.ts apps/api/src/index.ts packages/mcp/src/index.ts
rm -rf packages/db/src/stores/customEntityTypes.ts packages/db/src/stores/customEntityRecords.ts apps/api/src/routes/custom.ts packages/testing/src/custom-objects-full-stack.test.ts
```
