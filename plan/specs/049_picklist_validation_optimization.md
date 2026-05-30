# 049 — TD-002: Dynamic Field Picklist Validation Optimization

**Phase:** 2 (Replenish) · **Priority:** Medium · **Status:** `[x] Done` · **Depends on:** 035

## Description & Expected Impact

Currently, every Lead, Contact, Account, and Opportunity insert/update request dynamically performs sequential database queries to `dbStore.picklistDependencies.findMany()` and `dbStore.validationRules.findMany()`. On real Postgres, this results in at least two additional database network round-trips per payload, adding latency overhead.
We will optimize this by implementing:
1. **TTL Caching**: Cache picklist dependency and custom validation rule definitions in-memory with a short TTL (e.g. 5 seconds).
2. **Dynamic Invalidation**: Provide a mechanism to invalidate cache entries when custom field definitions or rules are written.

## Definition of Done & Acceptance Criteria

- [x] **In-Memory Cache (`apps/api/src/lib/validation.ts`)**:
  - Implement rolling TTL caching for `dbStore.picklistDependencies.findMany()` and `dbStore.validationRules.findMany()`.
  - Expose a `clearValidationCaches()` helper.
  - Intercept updates in tests or dynamically invalidate caches upon new rule/dependency insertions.
- [x] **Integration Tests**:
  - Verify that picklist/rule changes are correctly picked up after cache invalidation.
  - Ensure all 480+ workspace test suites remain fully green.
