# Specification: CPQ PDF Generator - Implementation Plan

## 1. Phase 1: Core Logic
- Append the `DiscountTier`, `CPQProductConfig`, `CPQPriceCalculation` interfaces and the `calculateCPQPrice` implementation to `packages/core/src/index.ts`.
- Run typecheck in `packages/core` to confirm correct syntax.

## 2. Phase 2: Hono Routes
- Mount `/api/opportunities/:oppId/quote` POST and GET REST endpoints inside `apps/api/src/index.ts`.
- Ensure appropriate RLS checks are performed:
  - Verify that the opportunity, its opportunity line items, the associated account, the document template, and the resulting merged quote document belong to the active tenant.
  - Automatically log the quote generation inside `mergedDocuments` so it persists within the system.

## 3. Phase 3: Verification Suite
- Create integration test suite `packages/testing/src/cpq.test.ts`.
- Run `pnpm verify` to confirm typescript building, Biome linter, and Vitest runs successfully.
