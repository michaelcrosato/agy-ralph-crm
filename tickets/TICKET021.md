# TICKET021: Split Contracts Routes Monolith (Spec 080)

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Decompose monolithic `apps/api/src/routes/contracts.ts` into focused sub-modules to achieve compliance with our strict 400-line file limit budget.
- **Context**: Spec 080 describes split boundaries, sub-routers mounting, and test verification strategies.

---

## Scope

### In Scope
- Create `contracts.ts`, `documents.ts`, `invoices.ts`, `subscriptions.ts` under `apps/api/src/routes/contracts/`.
- Decompose standard contracts CRUD, document templates and merges, batch pro-rated invoices, and subscriptions.
- Export `contractsApp`, `documentsApp`, `invoicesApp`, and `subscriptionsApp` from index.ts barrel to preserve index.ts exports and RPC client bindings.
- Remove old monolithic router file.
- Perform clean workspace verify run.

### Out of Scope
- Modifying backend core calculations or schemas.

---

## Steps to Execute
1. Implement the modular sub-routers inside `apps/api/src/routes/contracts/`.
2. Construct the entrypoint composter index.ts.
3. Remove monolithic `apps/api/src/routes/contracts.ts`.
4. Rerun `pnpm run agent:check` to verify no compilation or test regressions.

---

## Acceptance Criteria
- [x] No file exceeds 400 lines (barrel ≤ 100 lines).
- [x] Zod OpenAPI schema type inferences resolve cleanly in RPC client.
- [x] Document template compiling and pro-rated invoices execute cleanly.
- [x] All build gates and 546+ tests remain 100% green.
