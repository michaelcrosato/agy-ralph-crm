# Specification: Marketing Sequence Step Deletion & Cascading Shift Engine - Brief

## 1. Functional Objective
This feature introduces step-level deletion capabilities to the Marketing Automation module (Task 0217). When a step is deleted from a marketing sequence, the system must maintain step list contiguous, 1-indexed, consecutive integers (e.g. 1, 2, 3...).

When a step is deleted, the system must:
1. **Recalculate step numbers**: Decrement the `stepNumber` of all steps that were originally after the deleted step.
2. **Handle reply references**:
   - If another step has `replyToStepNumber` pointing to the deleted step's original step number, clear it (set to null).
   - If another step has `replyToStepNumber` pointing to a subsequent step that gets shifted down, update the reference to match the new decremented step number.
3. **Handle branching references**:
   - If the deleted step itself has a branch configuration in `marketing_sequence_step_branches`, delete that branch.
   - In `marketing_sequence_step_branches`, update `trueNextStepNumber` and `falseNextStepNumber` references:
     - Clear the reference (set to null) if it pointed to the deleted step's original step number.
     - Decrement the reference if it pointed to a subsequent step that gets shifted down.

## 2. Technical Scope
- **Tenancy Isolation**: All steps, sequences, and branches must be queried and mutated under strict tenant context checks. Mismatched tenant org IDs must trigger an RLS isolation error.
- **Pure Core Logic**: Core method `deleteMarketingSequenceStep(dbStore, sequenceId, stepId, orgId)` in `packages/core/src/index.ts` will load all steps, validate tenant context, delete the step, shift subsequent step numbers, remap references, and execute updates.
- **REST Endpoints**:
  - `DELETE /api/sequences/:id/steps/:stepId` - Deletes a specific step and triggers the cascading shift engine.
- **Verification**: Complete unit and integration test coverage validating tenant RLS, step deletion shifts, reference clearing and shifting, and API contract validations.
