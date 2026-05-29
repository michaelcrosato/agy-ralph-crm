# Specification: Marketing Sequence Global Merge Variables - Brief

## 1. Functional Objective
To enable modern enterprise marketing teams to reuse global tokens across multiple campaigns, this feature introduces **Task 0211: Marketing Sequence Global Merge Variables**.

This feature adds support for global merge variables that can be used inside sequence email templates, including:
1. **Global Placeholders**: Support resolving global organization-level variables, e.g. `{{global.companyPhone}}` or `{{global.supportEmail}}` in subject or body templates.
2. **Dynamic Fallbacks**: Support default values on global variables, e.g. `{{global.companyPhone | default("1-800-555-0199")}}`.
3. **Casing Filters**: Support casing transformations like uppercase or lowercase on global variable tokens, e.g. `{{global.companyName | uppercase}}`.
4. **REST Settings API**: Standard HTTP endpoints to CRUD global variables for the active tenant context.
5. **RLS tenant isolation**: Ensure global variables are isolated to the active tenant.

## 2. Technical Scope
- **Database Schema (`packages/db/src/schema.ts`)**:
  - Define `marketingSequenceGlobalVariables` table.
- **In-Memory database store (`packages/db/src/index.ts`)**:
  - Add `marketingSequenceGlobalVariables` to `store` and expose a mock db interface helper with active tenant check (RLS isolation).
- **Core Personalizer (`packages/core/src/index.ts`)**:
  - Fetch global variables under active tenant inside personalization execution flow.
  - Parse `{{global.key}}` placeholders and resolve them using the stored global variable values.
- **REST Endpoints in `apps/api` (`apps/api/src/index.ts`)**:
  - Expose `GET /api/sequences/settings/variables`, `POST /api/sequences/settings/variables`, and `DELETE /api/sequences/settings/variables/:id` under tenant authenticated routes.
- **Integration & RLS Tests (`packages/testing/src/marketing-sequence-global-variables.test.ts`)**:
  - Assert CRUD endpoint behaviors.
  - Assert correct resolution of `{{global.key}}` in template personalization.
  - Verify tenant RLS boundaries strictly block cross-tenant leaks.
