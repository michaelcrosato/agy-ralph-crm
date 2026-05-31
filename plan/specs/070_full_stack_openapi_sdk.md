# 070 — Full-Stack OpenAPI SDK Generation & Next.js Dashboard Integration

**Phase:** 4 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 017, 018, 068

## Description & Expected Impact
Currently, Hono sub-routers (such as accounts, contacts, opportunities, and custom entities) are partially defined as plain untyped Hono apps. This means the client SDK `hc<AppType>()` collapses to `unknown` for most paths, requiring developers to write untyped queries and manually type fetch JSON responses in Next.js `apps/web`.

This specification details the comprehensive migration of all remaining core CRM API routers to `@hono/zod-openapi`'s `OpenAPIHono` and routes, solidifying the monorepo boundary with a strongly-typed compile-time full-stack SDK.

## Definition of Done & Acceptance Criteria
- [ ] Migrate `accountsApp`, `contactsApp`, and `opportunitiesApp` from standard `Hono` to `OpenAPIHono` utilizing `.openapi(route, handler)` mapping.
- [ ] Declare full schema models for Account, Contact, and Opportunity in `@hono/zod-openapi` compatible schemas.
- [ ] Ensure that `@crm/api-client` exports the fully-realized strongly-typed Hono client type without `Record<string, any>` fallbacks.
- [ ] Refactor Next.js dashboard pages under `apps/web/src/app` (such as leads, accounts, and opportunities listings/actions) to consume the `@crm/api-client` strongly-typed client end-to-end.
- [ ] Expose Swagger and Scalar documentation fully loaded with these core endpoints under `GET /docs` and `GET /openapi.json`.
- [ ] All 154 integration tests and formatting audits remain 100% green and verified.

## Implementation Approach
1. **Zod OpenAPI Schemas**: Build Zod schemas representing request bodies and responses for Accounts, Contacts, and Opportunities matching the DB schemas in `packages/db`.
2. **Modular Routes Migration**:
   - In `apps/api/src/routes/accounts.ts`, swap `Hono` for `OpenAPIHono` and define `createRoute` instances for CRUD GET/POST/PATCH/DELETE endpoints.
   - Do the same in `contacts.ts` and `opportunities.ts`.
3. **SDK Type Realization**: Ensure `AppType` includes these routes correctly. Modify `packages/api-client/src/index.ts` to remove the fallback `Record<string, any>` type, realizing compile-time strict types across the monorepo.
4. **Next.js Integration**: Refactor page components in `apps/web/src/app` (e.g. leads page, accounts page, opportunities page) to utilize the strongly-typed client:
   - Swap manual fetch/headers with `apiClient.api.leads.$get()`, `apiClient.api.accounts.$get()`, etc.

## Test Strategy
- **Regression**: Run the comprehensive suite `pnpm test` sequentially to ensure no functional CRUD changes occurred.
- **Type Safety**: Verify that compiling the web dashboard via `pnpm build` succeeds with zero TypeScript typecast warnings or errors.

## Rollback
Revert route files to plain `Hono` structures and restore `packages/api-client`'s type fallbacks.
