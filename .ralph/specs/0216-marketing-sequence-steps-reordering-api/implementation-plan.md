# Specification: Marketing Sequence Steps Reordering API - Implementation Plan

## 1. Step-by-Step Sequence

1. **Write Core Business Logic**:
   - Implement `reorderMarketingSequenceSteps` in `packages/core/src/index.ts`.
   - Maintain pure relational domain and zero human placeholders rules.

2. **Add API Routing**:
   - Add the `POST /api/sequences/:id/steps/:stepId/reorder` endpoint inside `apps/api/src/index.ts`.
   - Ensure tenant propagation and context validation are done via `tenantAuth`.

3. **Scaffold Integration Tests**:
   - Create `packages/testing/src/marketing-sequence-reorder.test.ts`.
   - Implement comprehensive verification:
     - Shift up: moving Step 4 to 2, verify steps 2 and 3 shifted down.
     - Shift down: moving Step 2 to 4, verify steps 3 and 4 shifted up.
     - Verify `replyToStepNumber` is correctly updated.
     - Verify `trueNextStepNumber` and `falseNextStepNumber` in `marketingSequenceStepBranches` are updated.
     - Assert strict tenant RLS isolation (different tenant cannot reorder sequence steps).

4. **Verify Compile & Code Standards**:
   - Run verification scripts: `pnpm verify` to check Biome linting and Typecheck compilation.
   - Run tests: `pnpm test` or specific integration test via Vitest to confirm functional stability.
