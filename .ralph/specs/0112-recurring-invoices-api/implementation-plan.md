# Specification: Recurring Invoicing & Subscription Billing API - Implementation Plan

## 1. Phase 1: Core Logic
- Add the `calculateProRatedAmount` interface and method in `packages/core/src/index.ts`.
- Run typecheck in `packages/core` to confirm correct syntax.

## 2. Phase 2: Schema & Mock Store
- Add `subscriptions` and `invoices` schemas to `packages/db/src/schema.ts`.
- Add `DBSubscription`, `DBInvoice` types, stores, and `dbStore.subscriptions`, `dbStore.invoices` CRUD operations to `packages/db/src/index.ts`.
- Expose clear capability in `dbStore.clear()` to empty subscription and invoice lists during testing setup.

## 3. Phase 3: Hono Routes
- Mount the subscription creation, listings, invoice generation, and billing history REST endpoints inside `apps/api/src/index.ts`.
- Add multi-tenant checks to ensure RLS is correctly enforced on all inputs/outputs.

## 4. Phase 4: Verification Suite
- Create integration test suite `packages/testing/src/recurring-billing.test.ts`.
- Run `pnpm verify` to confirm typescript building, Biome linter, and Vitest runs successfully.
