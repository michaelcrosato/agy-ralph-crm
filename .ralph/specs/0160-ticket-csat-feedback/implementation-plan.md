# Task 0160: Support Ticket CSAT Feedback Integration - Implementation Plan

## Step 1: Database Schema & Store Extension
1. Update `packages/db/src/schema.ts` to add `ticketId` referencing `tickets` to `surveyResponses`.
2. Open `packages/db/src/index.ts`:
   - Update `DBSurveyResponse` interface.
   - Update `store.surveyResponses` mock seeding properties.
   - Update `dbStore.surveyResponses` crude methods (`insert` and add `findByTicket`).

## Step 2: Core Logic Implementation
1. Open `packages/core/src/index.ts`.
2. Define `calculateAgentCSATMetrics` pure aggregator function.
3. Export interfaces and functions.

## Step 3: REST Endpoints inside Hono Router
1. Open `apps/api/src/index.ts`.
2. Add Hono endpoints:
   - `POST /api/service/tickets/:id/feedback`
   - `GET /api/service/tickets/:id/feedback`
   - `GET /api/service/agents/:id/metrics`
3. Wire up tenant RLS context checking.

## Step 4: Integration & RLS Isolation Tests
1. Create `packages/testing/src/ticket-csat.test.ts`.
2. Assert feedback creation, default survey fallbacks, agent CSAT calculation metrics, and RLS tenant mismatch boundaries.

## Step 5: Verification Gate
1. Run `pnpm verify` to check Biome checks and TypeScript compilation.
2. Run `pnpm test` to verify Vitest tests.
3. Commit everything to Git and exit the loop.
