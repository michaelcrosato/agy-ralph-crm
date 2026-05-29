# Specification: Multi-Field Fuzzy Trigram Search - Implementation Plan

## 1. Phase 1: Core Search Aggregator
- Implement the `globalFuzzySearch` method and `GlobalSearchOptions` interface in `packages/search/src/index.ts`.
- Ensure proper imports from `@crm/db`.
- Run typecheck in `packages/search` to confirm correct syntax.

## 2. Phase 2: Hono Endpoint Mount
- Implement the `GET /api/search` endpoint in `apps/api/src/index.ts`.
- Ensure it requires authentication via the `tenantAuth` middleware to enforce correct tenant isolation context.
- Parse `q`, `types` (comma-separated), and `threshold` parameters.
- Invoke `globalFuzzySearch` within the tenant context.

## 3. Phase 3: Integration Tests
- Write a robust integration test suite in `packages/testing/src/search.test.ts`.
- Add test coverage for global search sorting, querying multiple types, custom fields searching, and verifying strict RLS tenant isolation.

## 4. Phase 4: Verification Gate
- Run `pnpm verify` and `pnpm test` to ensure clean compilation and all checks pass perfectly.
