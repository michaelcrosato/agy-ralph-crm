# Specification: Email HTML Templates & Merge Fields Engine API - Implementation Plan

## 1. Database & Store Modifications
1. Modify `packages/db/src/schema.ts` to define and export the `emailTemplates` table.
2. Modify `packages/db/src/index.ts` to add the `DBEmailTemplate` interface, `store.emailTemplates` mock array, and the `dbStore.emailTemplates` CRUD wrapper.

## 2. Core Business Logic Logic
1. Modify `packages/core/src/index.ts` to implement the `compileEmailTemplate` engine helper and export it.

## 3. API Route Registration
1. In `apps/api/src/index.ts`, import `compileEmailTemplate` from `@crm/core`.
2. Add the CRUD REST API routes under `/api/metadata/email-templates`.
3. Add the `POST /api/metadata/email-templates/:id/compile` compilation route. Retrieve Lead, Contact, Account, and Opportunity from the active tenant's context, compile, and return results.

## 4. Integration Verification
1. Create a comprehensive integration test in `packages/testing/src/email-templates.test.ts`.
2. Assert CRUD works cleanly, merge fields resolve correctly, missing fields resolve to `""`, and tenant RLS isolation works.
