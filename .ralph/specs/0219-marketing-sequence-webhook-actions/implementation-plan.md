# Specification: Marketing Sequence Webhook Actions - Implementation Plan

## 1. Phase 1: Database Model & Interfaces
- Modify `packages/db/src/schema.ts` to add columns `stepType`, `webhookUrl`, `webhookPayload` to the `marketingSequenceSteps` table and remove `.notNull()` from `templateId`.
- Modify `packages/db/src/index.ts` to update `DBMarketingSequenceStep` interface, `store.marketingSequenceSteps` initial array items if any, and CRUD/insert mapper helper to pass the new columns.

## 2. Phase 2: Core Processing Logic
- Update types in `packages/core/src/index.ts` to make sure `executePendingSequenceSteps` type signatures align with the new step fields.
- Update `executePendingSequenceSteps` to process `step.stepType === "webhook"` steps, enqueuing webhook outbox entries in `webhookOutbox`, and advancing the membership step.

## 3. Phase 3: REST Endpoint Integrations
- Update `POST /api/sequences/:id/steps` route in `apps/api/src/index.ts` to support optional templateId when type is webhook, validate webhookUrl format, and pass columns to database store.

## 4. Phase 4: Integration Test Suite
- Write integration tests inside `packages/testing/src/marketing-sequence-webhook-actions.test.ts` to assert that:
  - Creating a webhook step works cleanly.
  - Standard email steps still require a valid template.
  - Executing pending steps enqueues a `webhookOutbox` entry.
  - RLS tenant boundaries are perfectly maintained across all endpoints and execution paths.
- Run `pnpm verify` and `pnpm test` to validate success.
