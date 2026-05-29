# Specification: Dependent Picklists & Field Value Matrix API - Implementation Plan

## 1. Database & Store Modifications
1. Modify `packages/db/src/schema.ts` to export `picklistDependencies` pgTable definition.
2. Modify `packages/db/src/index.ts` to add the `DBPicklistDependency` interface, `store.picklistDependencies` array, and the `dbStore.picklistDependencies` wrapper.

## 2. Core Validation Logic
1. Modify `packages/core/src/index.ts` to add the `validatePicklistDependencies` core validation helper, and export it.

## 3. API Route Registration
1. In `apps/api/src/index.ts`, import `validatePicklistDependencies` from `@crm/core`.
2. Add the REST API routes under `/api/metadata/picklist-dependencies`.
3. Intercept `POST /api/leads`, `PATCH /api/leads/:id` (and equivalent routes for `accounts`, `contacts`, `opportunities`) to fetch the active tenant's picklist dependencies, extract the combined properties (combining standard top-level fields and custom JSONB fields), run `validatePicklistDependencies`, and return 400 Bad Request if validation fails.

## 4. Integration Verification
1. Create a comprehensive integration test in `packages/testing/src/dependent-picklists.test.ts`.
2. Test valid inputs conforming to dependencies, invalid inputs triggering validation errors, RLS validation checks preventing one tenant from seeing another's rules, and verify auditing behaves correctly.
