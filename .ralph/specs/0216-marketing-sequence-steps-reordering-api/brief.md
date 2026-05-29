# Specification: Marketing Sequence Steps Reordering API - Brief

## 1. Functional Objective
This feature introduces step-level reordering capabilities to the Marketing Automation module (Task 0216). In complex marketing sequences, users frequently need to insert, shift, or re-arrange the sequence of email steps. 

When a step is moved to a new position, the system must:
1. **Recalculate step numbers**: Shift other steps to keep step numbers consecutive and 1-indexed.
2. **Preserve reply references**: Dynamically update `replyToStepNumber` references on any step that replies to a shifted step.
3. **Preserve branching logic**: Update `trueNextStepNumber` and `falseNextStepNumber` in `marketing_sequence_step_branches` to match the new step numbers of the target steps.

## 2. Technical Scope
- **Tenancy Isolation**: All steps and sequences must be queried and mutated under strict tenant context checks. Mismatched tenant org IDs must trigger an RLS isolation error.
- **Pure Core Logic**: Core method `reorderMarketingSequenceSteps(dbStore, sequenceId, stepId, newStepNumber, orgId)` in `packages/core/src/index.ts` will load all steps, validate tenant context, compute shifts, remap references, and execute updates.
- **REST Endpoints**:
  - `POST /api/sequences/:id/steps/:stepId/reorder` - Reorders a specific step to `newStepNumber`.
- **Verification**: Complete unit and integration test coverage validating tenant RLS, reordering shifts (up and down), reference remapping, and API contract validations.
