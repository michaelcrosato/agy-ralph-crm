# Specification: Marketing Sequence Email Granular Click Events & UTM Tracking - Implementation Plan

## Step 1: Database Schema Modification
- Add the `emailClickEvents` schema and export it in `packages/db/src/schema.ts`.
- Update the mock db store in `packages/db/src/index.ts` to include the `emailClickEvents` database store definition with in-memory helper methods (e.g. `findForTracker` and `insert`).

## Step 2: Pure Domain Core helper
- Implement `parseUtmParams` in `packages/core/src/index.ts` to support robust UTM parameters extraction from tracking destination URLs.

## Step 3: REST Router Endpoint Scaffolding
- Update `apps/api/src/index.ts` to intercept `GET /api/public/emails/track/click/:token` and:
  - Extract the requester's IP and User Agent headers.
  - Parse UTM parameters from `target` query query-string if present.
  - Write a granular click event record under the active tenant context.
- Scaffold the new `GET /api/emails/trackers/:trackerId/clicks` REST endpoint in `apps/api/src/index.ts` under active organization RLS tenant checks.

## Step 4: Write Integration Tests
- Create `packages/testing/src/marketing-sequence-click-events.test.ts` to assert:
  - Public track click increments click count, saves a granular log, and correctly parses UTM tags (source, medium, campaign, etc.).
  - Proper falling back to default values for IP/User Agent if headers are omitted.
  - Granular logs are retrievable by authorized users under the same tenant.
  - Direct cross-tenant access to a tracker's click event logs is rejected with a `403` or `404` status code (RLS tenant boundary).

## Step 5: Verification Gate Pipeline
- Execute `pnpm verify` to confirm typescript compilation, biome checks, and vitest suites complete successfully without any errors or warnings.
