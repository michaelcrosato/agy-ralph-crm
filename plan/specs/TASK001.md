# Task 001: RLS Session Context Verification Helper

## 1. Description
Establish a unified connection context helper `assertSessionTenant(orgId)` within the database package to verify tenant tokens, preventing database context leaks in complex transactional cycles.

## 2. Acceptance Criteria (DoD)
- [ ] Implement `assertSessionTenant` in `packages/db/src/index.ts`.
- [ ] The function must throw a strict type `RLS Isolation Violation` error if the context does not match the active session parameter orgId.
- [ ] Standardize database mock execution functions to run assertions automatically on every `insert` or `update` query.
- [ ] Add integration test suites to `packages/testing/src/tenant.test.ts`.

## 3. Implementation Approach
- Use AsyncLocalStorage context store `tenantStorage.getStore()` inside queries.
- Compare transaction variable state with session variables.

## 4. Technical Specifications
- **Effort**: 1 session (Medium)
- **Dependencies**: None.
- **Likely Files**:
  - `packages/db/src/index.ts`
  - `packages/testing/src/tenant.test.ts`

## 5. Out of Scope
- Changing production database schemas or migrating production secrets.
