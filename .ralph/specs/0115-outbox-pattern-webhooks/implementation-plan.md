# Specification: Outbox Pattern Webhooks & Dead Letter Queue (DLQ) - Implementation Plan

## Step 1: Database Schema and Store Upgrades
- Update `packages/db/src/schema.ts` with `webhookOutbox` and `webhookDlq` pgTables.
- Update `packages/db/src/index.ts` to implement `DBWebhookOutbox`, `DBWebhookDlq` typescript interfaces, extend the in-memory `store` arrays, and expose robust `dbStore` interfaces for `webhookOutbox` and `webhookDlq` under active tenant RLS bounds.

## Step 2: Core Outbox Processing Logic
- In `packages/webhooks/src/index.ts`, add outbox processing, retry loops with exponential backoff, and dead-letter queue routing when a dispatch fails 5 times.
- Ensure all business operations remain fully isolated under the tenant's RLS environment.

## Step 3: API Integration in Hono Engine
- In `apps/api/src/index.ts`, replace the old direct dispatch method in `triggerOutboundWebhooks` with an enqueue-into-outbox operation.
- Implement `/api/webhooks/outbox`, `/api/webhooks/dlq`, and `/api/webhooks/process-outbox` endpoints.

## Step 4: Integration and RLS Boundary Tests
- Create `packages/testing/src/webhook-outbox.test.ts` to fully assert webhook outbox enqueueing, outbox processing, successful retry exponential backoff calculations, DLQ transition on the 5th failure, and rigorous tenant RLS checks.

## Step 5: Verification & Verification Gate
- Run `pnpm verify` and `pnpm test` to ensure zero compilation, typecheck, or lint issues, and that all test cases pass perfectly.
