# Specification: Custom Validation Rules Engine API - Implementation Plan

## 1. Database & Store Modifications
1. Modify `packages/db/src/schema.ts` to define and export `validationRules` table.
2. Modify `packages/db/src/index.ts` to add the `DBValidationRule` interface, `store.validationRules` mock array, and the `dbStore.validationRules` CRUD wrapper.

## 2. Core Business Logic Logic
1. Modify `packages/core/src/index.ts` to add the `validateCustomValidationRules` validation engine helper, and export it.

## 3. API Route Registration
1. In `apps/api/src/index.ts`, import `validateCustomValidationRules` from `@crm/core`.
2. Add the REST API routes under `/api/metadata/validation-rules`.
3. Intercept `POST /api/leads`, `PATCH /api/leads/:id`, `POST /api/accounts`, `PATCH /api/accounts/:id`, `POST /api/contacts`, `PATCH /api/contacts/:id`, `POST /api/opportunities`, and `PATCH /api/opportunities/:id` routes.
4. Load active tenant validation rules, merge properties, evaluate the custom validation rules, and abort with a 400 Bad Request if validation fails.

## 4. Integration Verification
1. Create a comprehensive integration test in `packages/testing/src/custom-validation-rules.test.ts`.
2. Assert valid creations conform to rules, rules fail and block invalid mutations with custom messages, active tenant RLS bounds isolate rules, and verify correct audit trails.
