# Spec 0125: Opportunity Stage History & Velocity Tracking API Implementation Plan

## Sequence of Updates

### Phase 1: Database Schema Expansion
1. Update `packages/db/src/schema.ts` to define the `opportunityStageHistory` table.
2. Export `opportunityStageHistory` from `packages/db/src/index.ts` if appropriate.

### Phase 2: Pure Core Business Logic
1. Update `packages/core/src/index.ts` to implement:
   * `StageHistoryInput` and `StageDuration` interfaces.
   * The pure function `calculateStageVelocity` which calculates total time spent in each stage across opportunities based on sequential transitions.
2. Build `@crm/core` to verify types.

### Phase 3: REST API Integration
1. Update `apps/api/src/index.ts` to hook into Opportunity creation and updates.
   * Upon creation of an Opportunity, insert an initial history entry with `fromStage = null`.
   * Upon stage transition during an update of an Opportunity, insert a history entry with the previous stage.
2. Implement endpoints:
   * `GET /api/opportunities/:id/stage-history` to fetch the chronological transitions.
   * `GET /api/reports/stage-velocity` to calculate velocity reports for the active tenant using all history entries.

### Phase 4: Integration & RLS Tests
1. Create a new test file: `packages/testing/src/opportunity-stage-history.test.ts`.
2. Write tests asserting:
   * Automatic stage history creation on Opportunity insert.
   * Automatic stage history creation on Opportunity stage update.
   * Calculation of velocity report returns valid averages.
   * Complete multi-tenant RLS isolation (tenant A cannot read or write tenant B's stage history).

### Phase 5: Verification Gate
1. Execute `pnpm verify` to check formatting, typescript compilation, and all unit/integration tests.
