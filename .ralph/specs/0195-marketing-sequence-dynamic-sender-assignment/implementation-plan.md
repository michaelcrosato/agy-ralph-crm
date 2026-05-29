# Specification: Marketing Sequence Dynamic Sender Assignment - Implementation Plan

## 1. Phase 1: Database & Mock Store Configuration
- Update `packages/db/src/schema.ts` to add the `senderType` and `senderUserId` columns to the `marketingSequences` table.
- Update `packages/db/src/index.ts`:
  - Update `DBMarketingSequence` interface.
  - Update any defaults or mappings inside mock DB initialization.

## 2. Phase 2: Core Worker Engine Upgrades
- Update `executePendingSequenceSteps` inside `packages/core/src/index.ts`:
  - Retrieve sequence details and evaluate `senderType`.
  - Fetch Lead or Contact recipient record to resolve `ownerId` if `senderType` is `"owner"`.
  - Use `senderUserId` if `senderType` is `"specific"`.
  - Pass the resolved sender ID as the `creatorId` during activity insert.

## 3. Phase 3: REST API Endpoints Mounting
- Update `POST /api/sequences` in `apps/api/src/index.ts` to accept and validate the new sender configurations.
- Add `PATCH /api/sequences/:id` in `apps/api/src/index.ts` to support partial sequence updates under active tenant RLS validation.

## 4. Phase 4: Verification Suite Execution
- Build integration test suite `packages/testing/src/marketing-sequence-sender.test.ts` asserting sender resolution rules, fallback mechanisms, dynamic send-as-owner resolution, and active tenant RLS bounds.
- Verify the workspace compiles and lint checks pass cleanly using `pnpm verify`.
