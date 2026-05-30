# 031 — Public `defineObject()` SDK for no-code custom objects

**Phase:** 2 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 011, 014

## Description & Expected Impact
Twenty 2.0's killer feature: users define new objects (`Project`, `Subscription`, etc.) via UI without writing code or running SQL migrations. Repo has `packages/metadata` storing `fieldDefinitions` + `layoutDefinitions` but no public API. Build the SDK: `defineObject(tenantId, spec)` registers a new logical entity, allocates a JSONB-backed Postgres table partition (or row in a shared `custom_entities` table), and registers REST/MCP endpoints automatically.

## Definition of Done & Acceptance Criteria
- [ ] `packages/metadata/src/defineObject.ts` exports the SDK.
- [ ] Schema (Drizzle): `custom_entity_types` (id, tenant_id, name, fields_json), `custom_entity_records` (id, tenant_id, type_id, data jsonb).
- [ ] REST endpoints auto-registered at `/api/custom/:typeName` (CRUD).
- [ ] MCP tools auto-registered (`crm_create_<typeName>`, `crm_get_<typeName>`).
- [ ] Field types supported: string, number, boolean, date, lookup (FK to another entity), picklist, multi-picklist, rich-text.
- [ ] Validation: Zod-derived per `fieldDefinitions` (reuse spec 025 pattern).
- [ ] RLS enforced via tenant_id (spec 014 policies cover `custom_entity_records`).
- [ ] Integration tests: define 3 custom objects in a test, create/read/update/delete records.

## Implementation Approach
- Two-table approach: 1 record table + 1 type-meta table. JSONB for flexibility.
- Pre-compile Zod schema on object definition; cache.
- Lookup fields stored as `{ entity_type: string, entity_id: uuid }` JSONB.
- Indexed: `(tenant_id, type_id, created_at)` composite + GIN on `data` for ad-hoc filters.

## Test Strategy
- Integration: 6 new tests covering definition, instantiation, lookup, RLS, query.
- Property: 50 random schemas + random records, assert RLS holds.

## Rollback
Disable feature flag `CUSTOM_OBJECTS_ENABLED`.

## References
- [Twenty 2.0 announcement](https://twenty.com/)
