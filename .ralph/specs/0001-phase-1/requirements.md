# Phase 1: Identity, Tenancy, & Security Foundation - Requirements

## Functional Requirements
1. **Organization Registration:** Ability to register new organizations with name, status, and created date.
2. **User Registration:** Ability to register users with email, password hashing, and active/inactive status.
3. **Memberships & Roles:** Link users to organizations using memberships, assigning role permissions masks.
4. **Token Parser & Context Middleware:** Parse JWT or session tokens to load the active user and organization context (`tenant context`).
5. **Global RLS Engine:** Set PostgreSQL transaction variables (`app.current_org_id`) to automatically enforce tenant isolation.

## Security & Verification Requirements
1. **Multi-Tenant Security:** A user in `Tenant A` must NEVER be able to query, mutate, or view any record belonging to `Tenant B`.
2. **RLS Database Tests:** Implement property-based tenant security tests in `packages/testing` simulating concurrent cross-tenant requests.
3. **TypeScript / Lint Compilation:** All code must compile cleanly via `pnpm typecheck` / `pnpm verify` with zero warnings or errors.
