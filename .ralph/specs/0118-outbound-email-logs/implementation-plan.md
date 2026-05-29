# Specification: Outbound Email Log Adapters & Service Activity Integrations - Implementation Plan

We will perform the following contiguous implementation steps to fulfill this specification:

## Step 1: Extend `packages/core/src/index.ts`
Implement email log input structures, the `validateEmailLogInput` pure utility function, and export them.

## Step 2: Implement REST Routing in `apps/api/src/index.ts`
1. Import `validateEmailLogInput` from `@crm/core`.
2. Register Hono endpoints:
   - `POST /api/emails/log`
   - `GET /api/emails/:id`
3. Implement strict RLS context assertion inside the endpoints to prevent data leakage.

## Step 3: Write Integration & RLS Tests
Create a dedicated test file `packages/testing/src/email-logs.test.ts` to test:
- Successful email logging with valid fields and links.
- Rejection of invalid inputs (invalid email syntax, missing body/subject).
- Verification of RLS security boundaries (asserting cross-tenant boundary access throws or returns 404).

## Step 4: Verification Gate & Compile
Run `pnpm verify` to confirm that:
- Clean TypeScript types compile cleanly.
- Biome lints pass perfectly.
- Vitest execution suite runs with 100% success.
