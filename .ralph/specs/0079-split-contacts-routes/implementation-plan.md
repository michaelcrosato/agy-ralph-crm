# Spec 079 Implementation Plan

## Steps

1. **Extract CRUD Router**: Move standard retrieve (OpenAPI list and single), creation, updates, and validations to `apps/api/src/routes/contacts/crud.ts`. Export `ContactSchema`, `getContactRoute`, and `listContactsRoute`.
2. **Extract Hierarchy Router**: Move parent path and direct reports queries to `apps/api/src/routes/contacts/hierarchy.ts`.
3. **Extract Operations Router**: Move duplicates checking, merge operations, cascading updates, and AI qualification enrichment trigger routes to `apps/api/src/routes/contacts/operations.ts`.
4. **Create Barrel index**: Export `contactsApp` composing all three sub-routers inside `apps/api/src/routes/contacts/index.ts`. Re-export OpenAPI client route helpers from `crud.ts`.
5. **Remove Monolith**: Safely remove monolithic `apps/api/src/routes/contacts.ts`.
6. **Verify Monorepo**: Run linter, compiler, tests, and preflights using `pnpm run agent:check`.
