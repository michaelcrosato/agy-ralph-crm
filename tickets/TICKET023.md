# TICKET023: Split Opportunities Products Routes Monolith (Spec 082)

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Decompose monolithic `apps/api/src/routes/opportunities/products.ts` into focused sub-modules to achieve compliance with our strict 400-line file limit budget.
- **Context**: Spec 082 describes split boundaries, sub-routers mounting, and test verification strategies.

---

## Scope

### In Scope
- Create `products.ts`, `line-items.ts`, `quotes.ts`, `schedules.ts` under `apps/api/src/routes/opportunities/products/`.
- Decompose product catalog CRUD, opportunity line items, quoting CPQ logic, and payment schedules.
- Export unified `productsApp` and `opportunitiesProductsApp` from `index.ts` barrel to preserve route mounting and RPC client bindings.
- Remove old monolithic router file `apps/api/src/routes/opportunities/products.ts`.
- Perform clean workspace verify run (`pnpm run agent:check`).

### Out of Scope
- Modifying backend core calculations or schemas.

---

## Steps to Execute
1. Create `apps/api/src/routes/opportunities/products/` directory.
2. Implement the modular sub-routers inside `apps/api/src/routes/opportunities/products/`.
3. Construct the entrypoint composter `index.ts` in that folder.
4. Remove monolithic `apps/api/src/routes/opportunities/products.ts`.
5. Rerun `pnpm run agent:check` to verify no compilation or test regressions.

---

## Acceptance Criteria
- [x] No file exceeds 400 lines (barrel ≤ 100 lines).
- [x] Zod OpenAPI schema type inferences resolve cleanly in RPC client.
- [x] Products CRUD, opportunity line items, quoting CPQ, and payment schedules logic execute cleanly.
- [x] All build gates and 546+ tests remain 100% green.
