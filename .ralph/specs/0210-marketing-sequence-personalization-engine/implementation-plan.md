# Specification: Marketing Sequence Personalization Engine - Implementation Plan

This plan outlines the sequence of files to create and edit to deliver the Personalization Engine.

## Step 1: Implement Dynamic Personalizer in core (`packages/core/src/index.ts`)
1. Implement `personalizeEmailTemplate(template, context)`:
   - Handle nested path value resolving via `getFieldValue`.
   - Resolve conditional blocks `{% if condition %}true{% else %}false{% endif %}`.
   - Resolve placeholders `{{path.to.field}}` with support for chained filters `default("fallback")`, `uppercase`, and `lowercase`.
2. Update `compileEmailTemplate` to invoke `personalizeEmailTemplate`.

## Step 2: REST API Preview Integration (`apps/api/src/index.ts`)
1. Export `personalizeEmailTemplate` or import it in `apps/api/src/index.ts` if not already exported.
2. Register the endpoint `POST /api/sequences/preview`:
   - Enforce authentication/session context checking.
   - Retrieve lead or contact under active tenant context.
   - Execute template compilation and return `{ subject, body }`.
   - Block cross-tenant access with strict RLS exceptions.

## Step 3: Write Comprehensive Integration & RLS Tests (`packages/testing/src/marketing-sequence-personalization.test.ts`)
1. Write tests asserting:
   - Standard path resolution.
   - Default fallbacks (`{{lead.firstName | default("there")}}`).
   - Filters combination (`{{lead.company | default("my co") | uppercase}}`).
   - Conditional logic checks (`{% if lead.company %}...{% else %}...{% endif %}`).
   - Tenant RLS isolation checking (a tenant user cannot preview a lead or contact owned by another tenant).

## Step 4: Verification Gate
1. Execute `pnpm verify` to check compilation and Biome linting rules.
2. Execute `pnpm test` to run all Vitest integration suites.
