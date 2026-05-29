# Specification: Contact Consent & GDPR Compliance API - Implementation Plan

## Step 1: Database Schema Expansion
1. Update [schema.ts](file:///C:/dev/agy-ralph-crm/packages/db/src/schema.ts) by adding the `contactConsentPreferences` table schema definition.
2. Update [index.ts](file:///C:/dev/agy-ralph-crm/packages/db/src/index.ts) to register the new store array for `contactConsentPreferences`. Update db query methods to support operations on this collection.

## Step 2: Core Domain Logic Implementation
1. Edit [packages/core/src/index.ts](file:///C:/dev/agy-ralph-crm/packages/core/src/index.ts) to include the `ConsentPreference` and `ConsentValidationInput` interfaces, and implement the pure `validateCommunicationConsent` function.
2. Export these types and the function from the core library.

## Step 3: REST Routes Integration
1. Edit [apps/api/src/index.ts](file:///C:/dev/agy-ralph-crm/apps/api/src/index.ts) to add:
   - Zod validation schema for consent upsert body payload.
   - `GET /api/consent` route to query preferences under active tenant context.
   - `POST /api/consent` route to upsert preference records under active tenant context.

## Step 4: Integration & RLS Tests
1. Create the integration test suite file [packages/testing/src/contact-consent.test.ts](file:///C:/dev/agy-ralph-crm/packages/testing/src/contact-consent.test.ts).
2. Write tests covering:
   - Core `validateCommunicationConsent` evaluation behavior (opt_in vs opt_out vs pending vs missing).
   - `GET` and `POST` API endpoints under correct tenant contexts.
   - Validation failures (e.g. invalid fields or missing headers).
   - Strict Row-Level Security (RLS) validation proving Tenant A cannot view or alter Tenant B's consent settings.

## Step 5: Verification & Verification Pipeline
1. Run `pnpm verify` to trigger turbo build, linting, typechecking, and the Vitest test suites.
2. Verify all checks pass without errors.
