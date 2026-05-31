# Spec 077 Implementation Plan

## Steps

1. **Deconstruct CRUD Routes**: Extract `AccountSchema`, `listAccountsRoute`, `getAccountRoute`, list and get OpenAPI Hono bindings, and standard `POST` and `PATCH` endpoints to `apps/api/src/routes/accounts/crud.ts`.
2. **Deconstruct Hierarchy Routes**: Extract path building, parent path searches, and hierarchical consolidations to `apps/api/src/routes/accounts/hierarchy.ts`.
3. **Deconstruct Team Routes**: Extract member listings, updates, validation logic, and deletes to `apps/api/src/routes/accounts/team.ts`.
4. **Deconstruct Operations Routes**: Extract duplicates checking, record merging, and territory routing rules evaluations to `apps/api/src/routes/accounts/operations.ts`.
5. **Create Barrel index**: Export `accountsApp` composing all sub-routers inside `apps/api/src/routes/accounts/index.ts`.
6. **Remove Monolith**: Safely remove `apps/api/src/routes/accounts.ts`.
7. **Verify Monorepo**: Run linter, compiler, tests, and preflights using `pnpm run agent:check`.
