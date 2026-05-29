# Spec 0131: Lead SLA & Response Aging Tracking Implementation Plan

## Step 1: Database Schema Modification
- Open `packages/db/src/schema.ts`.
- Add `leadSlaTargets` and `leadSlaTrackers` table definitions at the bottom of the file.

## Step 2: Store Engine Expansion
- Open `packages/db/src/index.ts`.
- Add `leadSlaTargets` and `leadSlaTrackers` to the exports, the DB schema declarations, the mock database initialization, and collection maps.
- Export matching `DBLeadSlaTarget` and `DBLeadSlaTracker` type definitions and helper types.

## Step 3: Core Calculations Implementation
- Open `packages/core/src/index.ts`.
- Implement `calculateSlaStatus` function.
- Export function and associated interface.

## Step 4: REST API Endpoints Scaffolding
- Open `apps/api/src/index.ts`.
- Scaffold new routes:
  - `POST /api/leads/sla-targets`: Register/update SLA configurations.
  - `GET /api/leads/sla-targets`: Retrieve active configuration.
  - `GET /api/leads/sla-breaches`: Perform live scans, trigger dynamic state transitions, and return breached leads.
  - `POST /api/leads/:id/respond`: Complete a lead's response tracker, log audit trace, and fire webhooks.

## Step 5: Integration & RLS Isolation Tests
- Create `packages/testing/src/lead-sla.test.ts`.
- Assert standard CRUD operations for SLA Targets.
- Assert lead creation automatically setups a pending tracker (if target configured).
- Assert response marking successfully records response time and sets `Met`/`Breached` appropriately.
- Assert breach scanning captures aging leads and updates status dynamically.
- Assert strict RLS tenant isolation across all endpoints.

## Step 6: Verification Gate Verification
- Run `pnpm verify` to trigger Biome linter, TypeScript compiler, and Vitest suite execution.
- Resolve any typecheck or linting issues.

## Step 7: Git Commit Completed Feature
- Stage files: `git add .`
- Commit: `feat(leads): implement Lead SLA and Response Aging Tracking API, RLS tests (task 0131)`
