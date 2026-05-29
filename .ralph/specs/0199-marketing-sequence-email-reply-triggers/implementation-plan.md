# Specification: Marketing Sequence Email Reply Triggers - Implementation Plan

## Step 1: Database Schema Modification
- Edit `packages/db/src/schema.ts` to add the `marketingSequenceReplyActions` table and columns `replyCount`, `lastRepliedAt` to `emailTrackers`.
- Edit `packages/db/src/index.ts` to add the in-memory DB definition, mocks, and schema updates for `DBEmailTracker` and `marketingSequenceReplyActions`.

## Step 2: Core Processor Engine Integration
- Edit `packages/core/src/index.ts` to implement `processSequenceEmailReply` following the design patterns of `processSequenceEmailOpen` and `processSequenceEmailClick`.

## Step 3: REST Endpoint Scaffolding
- Edit `apps/api/src/index.ts` to expose `/api/sequences/steps/:stepId/reply-actions` and `/api/public/emails/track/reply/:token` endpoints under active tenant organization RLS context checks.

## Step 4: Write Integration Tests
- Create `packages/testing/src/marketing-sequence-reply-triggers.test.ts` asserting all functional requirements, auto-completion, field updates, tasks creation, and strict RLS tenant isolation boundaries.

## Step 5: Verification & Verification Pipeline
- Run `pnpm verify` and `pnpm test` to ensure all type-safety, styling lint, and tests pass successfully.
