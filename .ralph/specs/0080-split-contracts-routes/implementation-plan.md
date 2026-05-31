# Spec 080 Implementation Plan

## Steps

1. **Extract Subscriptions Router**: Extract subscriptions endpoints to `apps/api/src/routes/contracts/subscriptions.ts`.
2. **Extract Invoices Router**: Extract invoices pro-rating calculations and batch generation to `apps/api/src/routes/contracts/invoices.ts`.
3. **Extract Documents Router**: Extract document templates and merge compiling logic to `apps/api/src/routes/contracts/documents.ts`.
4. **Extract Contracts Router**: Extract contracts CRUD and renewal generators to `apps/api/src/routes/contracts/contracts.ts`.
5. **Create Barrel index**: Export `contractsApp`, `documentsApp`, `invoicesApp`, and `subscriptionsApp` inside `apps/api/src/routes/contracts/index.ts`.
6. **Remove Monolith**: Safely remove monolithic `apps/api/src/routes/contracts.ts`.
7. **Verify Monorepo**: Run linter, compiler, tests, and preflights using `pnpm run agent:check`.
