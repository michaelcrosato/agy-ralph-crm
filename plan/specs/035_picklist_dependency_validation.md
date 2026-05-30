# 035 — Finish legacy TICKET006 — picklist dependency validation

**Phase:** 2 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 011

## Description & Expected Impact
Legacy `tickets/TICKET006.md` is open: server-side `enforcePicklistDependencies` hook on `/api/leads` + `/api/contacts` rejects POST/PUT when dependent picklist values violate tenant metadata (e.g., state=California, city=Seattle → 400).

## Definition of Done & Acceptance Criteria
- [ ] Hook implemented in `apps/api/src/middleware/picklist.ts` (post-spec 010 location).
- [ ] Lookups cached in-memory per tenant (LRU 5min) to avoid metadata reads per request.
- [ ] On violation: 400 with JSON `{ error: "PICKLIST_DEPENDENCY_VIOLATION", details: [...] }`.
- [ ] Tests in `packages/testing/src/picklist-dependency-validation.test.ts` cover violation + valid + cache hit + cross-tenant.
- [ ] Legacy ticket updated.

## Implementation Approach
- Reuse metadata package; do not duplicate config storage.
- Apply hook only to fields declared as picklist + dependent in metadata.

## Test Strategy
- Integration: 5 tests.

## Rollback
Remove middleware registration.
