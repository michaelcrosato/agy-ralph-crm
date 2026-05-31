# 079 — Split routes/contacts.ts (457 → ≤400 lines)

**Phase:** 6 · **Priority:** High · **Status:** `[x] Done` · **Depends on:** None

## Description & Expected Impact
`apps/api/src/routes/contacts.ts` has grown to 457 lines (exceeding the 400-line budget limit). It contains standard CRUD, picklist/custom validations, reporting hierarchy paths, duplicates checking, AI enrichment bot triggers, and merge cascade database updates in a single file. Decomposing it preserves type-safety and lowers complexity.

## Definition of Done & Acceptance Criteria
- [x] Create route sub-modules under `apps/api/src/routes/contacts/` (each ≤400 lines).
- [x] `contacts/index.ts` barrel composes and exports the final `contactsApp` (≤100 lines).
- [x] Remove monolithic `apps/api/src/routes/contacts.ts`.
- [x] All workspace verify compiler, biome checks, and 546+ integration tests pass 100% green.
- [x] Zero behavioral regressions.

## Implementation Approach
1. Deconstruct and extract CRUD routes to `contacts/crud.ts`. Export `ContactSchema`, `getContactRoute`, and `listContactsRoute`.
2. Extract reporting hierarchy routes to `contacts/hierarchy.ts`.
3. Extract duplicates, merge operations, and AI enrichment bot to `contacts/operations.ts`.
4. Compose and re-export the router barrel under `contacts/index.ts`.
5. Safe delete `apps/api/src/routes/contacts.ts` and run workspace verifications.

## Rollback
- Revert directory creation and restore monolithic `apps/api/src/routes/contacts.ts` file from git history.
