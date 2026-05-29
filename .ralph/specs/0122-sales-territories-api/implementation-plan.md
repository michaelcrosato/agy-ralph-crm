# Task 0122: Sales Territories & Account Routing Engine - Implementation Plan

## Phase 1: Database Schema Expansion
1. Edit `packages/db/src/schema.ts` to add the `territories` and `territoryMembers` Drizzle tables.
2. Edit `packages/db/src/index.ts` to define types, mock store arrays, and `dbStore` active tenant RLS collections for `territories` and `territoryMembers`.

## Phase 2: Core Routing Engine Implementation
1. Add interfaces (`TerritoryCriteriaCondition`, `TerritoryInput`, `TerritoryMemberInput`, `TerritoryMatchResult`) to `packages/core/src/index.ts`.
2. Add the pure function `evaluateTerritoryRouting` executing active territory criteria matching, Primary member filtering, and Direct / Round-Robin assignment logic to `packages/core/src/index.ts`.

## Phase 3: REST API Endpoints Integration
1. Edit `apps/api/src/index.ts` to register endpoints for territories management, territory members, and Account routing execution.
2. Under Account routing execution (`POST /api/accounts/:id/route`):
   - Find active tenant territories and their members.
   - Run the core evaluation logic.
   - If a match occurred and ownerId was assigned, update the Account's ownerId, set account territory custom fields, and log a change in the `audit_logs` store.
   - Trigger outbound webhook events (`account.routed`).

## Phase 4: Verification & Integration Testing
1. Create a new test suite file `packages/testing/src/territory.test.ts` asserting multi-tenant isolation, Direct and Round-Robin assignments, custom criteria evaluations, audit trails, and webhooks.
2. Execute `pnpm verify` to confirm workspace compiles cleanly and all test suites pass.
3. Commit all changes to Git.
