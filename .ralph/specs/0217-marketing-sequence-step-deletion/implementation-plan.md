# Specification: Marketing Sequence Step Deletion & Cascading Shift Engine - Implementation Plan

## 1. Step-by-Step Sequence

1. **Write Core Business Logic**:
   - Implement `deleteMarketingSequenceStep` in `packages/core/src/index.ts`.
   - Maintain pure relational domain and zero human placeholders rules.

2. **Add API Routing**:
   - Add the `DELETE /api/sequences/:id/steps/:stepId` endpoint inside `apps/api/src/index.ts`.
   - Ensure tenant propagation and context validation are done via `tenantAuth`.

3. **Scaffold Integration Tests**:
   - Create `packages/testing/src/marketing-sequence-step-deletion.test.ts`.
   - Implement comprehensive verification:
     - Verify deleting a step decrements subsequent step numbers.
     - Verify `replyToStepNumber` references:
       - Set to `null` if pointing to deleted step.
       - Decremented by 1 if pointing to a subsequent step that was shifted.
     - Verify `trueNextStepNumber` and `falseNextStepNumber` in `marketingSequenceStepBranches` are updated.
     - Assert strict tenant RLS isolation (different tenant cannot delete sequence steps).

4. **Verify Compile & Code Standards**:
   - Run verification scripts: `pnpm verify` to check Biome linting and Typecheck compilation.
   - Run tests: `pnpm test` or specific integration test via Vitest to confirm functional stability.
