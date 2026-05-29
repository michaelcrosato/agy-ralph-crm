# Spec 0133: Contact Hierarchies & Organizational Org Charts Implementation Plan

## Step 1: Database Schema Modification
- Add the `reportsToId` column to the `contacts` table in `packages/db/src/schema.ts` as a self-referential foreign key pointing to `contacts.id`.
- Re-export `AnyPgColumn` if needed, or reference `contacts.id` using a lazy thunk `(): AnyPgColumn => contacts.id` to prevent circular definition issues in TypeScript/Drizzle.

## Step 2: Core Logic Implementation
- Implement the `SimpleContactRelation` interface and the pure `detectCircularContactRelation` helper function in `packages/core/src/index.ts`.
- Export these from `packages/core/src/index.ts`.

## Step 3: API REST Endpoints Implementation
- Update the Hono API routes in `apps/api/src/index.ts`:
  - Add logic in `/api/contacts/:id` route to check for `reportsToId` changes, run circular reference validations, log the audit trail change, and dispatch webhooks.
  - Implement a new route `/api/contacts/:id/hierarchy` that traverses the direct and indirect managers (upwards) and queries direct reports (downwards).

## Step 4: Write Integration & RLS Tests
- Create `packages/testing/src/contact-hierarchy.test.ts` containing:
  - Unit/integration test verifying standard reporting paths.
  - Test verifying circular reference prevention and throwing `400 Bad Request`.
  - Test verifying strict RLS isolation: one tenant cannot query or link to contacts from another tenant.

## Step 5: Verification Gate
- Run `pnpm verify` to check type safety, linting checks, and test suites.
