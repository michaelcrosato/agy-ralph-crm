# Specification: Opportunity Kanban Board Pipeline View API - Implementation Plan

## 1. Phase 1: Core Compiler Logic
- Add the `KanbanStageSummary` interface and the pure `compileKanbanPipeline` compiler method to `packages/core/src/index.ts`.
- Run typecheck in `packages/core` to confirm compiler correctness.

## 2. Phase 2: Hono API Routing
- Mount `GET /api/opportunities/kanban` route in `apps/api/src/index.ts`.
- Mount `POST /api/opportunities/kanban/transition` route in `apps/api/src/index.ts`.
- Enforce full RLS isolation checks, stage gates validation, workflow execution, audit logging, and webhook notifications during the transition pipeline.

## 3. Phase 3: Integration Tests
- Create integration test suite `packages/testing/src/opportunities-kanban.test.ts`.
- The tests should verify correct Kanban summaries, tenant separation, gate validations, and stage-changed side-effects.

## 4. Phase 4: Verification Gate
- Run `pnpm verify` and `pnpm test` to verify everything builds, typechecks, lints, and passes Vitest cleanly.
