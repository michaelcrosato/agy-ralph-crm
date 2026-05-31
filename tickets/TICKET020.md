# TICKET020: Split Contacts Routes Monolith (Spec 079)

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Decompose monolithic `apps/api/src/routes/contacts.ts` into focused sub-modules to achieve compliance with our strict 400-line file limit budget.
- **Context**: Spec 079 describes split boundaries, sub-routers mounting, and test verification strategies.

---

## Scope

### In Scope
- Create `crud.ts`, `hierarchy.ts`, `operations.ts` under `apps/api/src/routes/contacts/`.
- Decompose standard contacts CRUD, hierarchy parent path queries, duplicates listings, merging logic, and enrichment.
- Export unified `contactsApp` from `index.ts` barrel preserving Hono OpenAPI bindings and type client bindings.
- Remove old monolithic router file.
- Perform clean workspace verify run.

### Out of Scope
- Modifying backend core calculations or schemas.

---

## Steps to Execute
1. Implement the modular sub-routers inside `apps/api/src/routes/contacts/`.
2. Construct the entrypoint composter `index.ts`.
3. Remove monolithic `apps/api/src/routes/contacts.ts`.
4. Rerun `pnpm run agent:check` to verify no compilation or test regressions.

---

## Acceptance Criteria
- [x] No file exceeds 400 lines (barrel ≤ 100 lines).
- [x] Zod OpenAPI schema type inferences resolve cleanly in RPC client.
- [x] Picklist and custom dynamic validation rules execute on inserts/updates.
- [x] Circular dependency checks prevent manager hierarchy loops.
- [x] All build gates and 546+ tests remain 100% green.
