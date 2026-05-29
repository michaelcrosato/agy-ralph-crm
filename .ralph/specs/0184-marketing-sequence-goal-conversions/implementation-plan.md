# Specification: Marketing Sequence Conversion Goals & Attribution Engine - Implementation Plan

## Step 1: Database Setup
1. Edit `packages/db/src/schema.ts` to add `marketingSequenceGoals` and `marketingSequenceConversions` pgTable declarations.
2. Edit `packages/db/src/index.ts` to add schema bindings, in-memory store definitions, and helper query routines for both tables (e.g. `findForSequence`).

## Step 2: Core Logic Implementation
1. Edit `packages/core/src/index.ts` to import schemas and interfaces.
2. Implement `evaluateSequenceGoals` function.
3. Integrate `evaluateSequenceGoals` inside the background runner method `executePendingSequenceSteps` right before standard step execution, so that if a conversion goal is achieved, the membership is immediately marked as `"converted"`, logged, and advanced steps are bypassed.

## Step 3: REST API Endpoint Extensions
1. Edit `apps/api/src/index.ts` to register API routes:
   - `GET /api/sequences/:id/goals`
   - `POST /api/sequences/:id/goals`
   - `GET /api/sequences/:id/conversion-analytics` which compiles aggregated performance data.

## Step 4: Integration Testing
1. Add `packages/testing/src/marketing-sequence-conversions.test.ts` to assert:
   - Active memberships dynamically convert when Lead status transitions match the goal definition.
   - Revenue attribution correctly parses Opportunity amount values.
   - Strict tenant RLS checks verify Tenant B cannot retrieve Tenant A's conversions.
