# Specification: Campaign Email Open & Click Tracking API - Implementation Plan

## Step 1: Database Setup
1. Define the `emailTrackers` schema in `packages/db/src/schema.ts`.
2. Define the interface and in-memory operations for `emailTrackers` in `packages/db/src/index.ts`.

## Step 2: Core Helpers
1. Add any tracker helpers to `packages/core/src/index.ts`.

## Step 3: API Integration
1. Implement REST API endpoints in `apps/api/src/index.ts`:
   - `POST /api/emails/:activityId/tracker`
   - `GET /api/emails/:activityId/tracker`
   - `GET /api/public/emails/track/open/:token`
   - `GET /api/public/emails/track/click/:token`

## Step 4: Integration & RLS Tests
1. Create `packages/testing/src/campaign-email-tracking.test.ts` to fully test tracker creation, open recording, click recording, public bypass, and multi-tenant RLS isolation.

## Step 5: Verification Gate
1. Execute `pnpm verify` to check type safety, code formatting, linting, and run the new tests.
