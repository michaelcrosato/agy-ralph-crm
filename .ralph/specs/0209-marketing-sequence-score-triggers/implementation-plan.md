# Specification: Marketing Sequence Score-Based Automation Triggers - Implementation Plan

This plan details the exact files and lines of code to create/modify to build the scoring triggers engine.

## Step 1: Database Model & Store Scaffolding (`packages/db/src/index.ts`)
1. Define the `DBMarketingSequenceScoreTrigger` interface.
2. Extend the `store` object to add the `marketingSequenceScoreTriggers: []` array.
3. Implement `marketingSequenceScoreTriggers` store methods:
   - `findMany`
   - `findForSequence`
   - `findOne`
   - `insert`
   - `delete`
4. Add clear store array initialization in `clearDatabase` method.

## Step 2: Core Domain Logic implementation (`packages/core/src/index.ts`)
1. Implement and export `processSequenceMembershipScoreTriggers(db, orgId, membershipId)`.
2. Ensure the lead status transition, auto-exit, and task/notification trigger logic are fully covered.

## Step 3: REST API Integration (`apps/api/src/index.ts`)
1. Export/import core trigger runner in `apps/api/src/index.ts`.
2. Add endpoints:
   - `POST /api/sequences/:id/triggers`
   - `GET /api/sequences/:id/triggers`
   - `DELETE /api/sequences/triggers/:id`
3. Hook trigger execution into `recalculateMemberEngagementScore(membershipId)`.

## Step 4: Write Comprehensive RLS & Integration Test Suite (`packages/testing/src/marketing-sequence-score-triggers.test.ts`)
1. Test score-based lead status transitions.
2. Test sequence auto-exits.
3. Test owner task follow-up creation and linkage.
4. Test strict tenant Row-Level Security (RLS) isolation boundaries:
   - Tenant A cannot query Tenant B's triggers.
   - Tenant A cannot create/delete Tenant B's triggers.
   - Triggering recalculation for Tenant A member must never invoke or leak to Tenant B's triggers.

## Step 5: Verification
1. Run `pnpm verify` to check formatting and TypeScript compilation.
2. Run `pnpm test` to verify all Vitest tests pass cleanly.
