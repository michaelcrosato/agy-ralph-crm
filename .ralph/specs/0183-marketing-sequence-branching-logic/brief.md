# Specification: Marketing Sequence Dynamic Branching & Event Paths - Brief

## 1. Functional Objective
In marketing automation, drip campaigns need to adapt to user engagement. If a customer clicks a link in an email, they should receive a different set of follow-up messages than if they ignored it.
This feature introduces dynamic event-driven branching logic to Marketing Sequences in the CRM.
Marketing managers can configure step-level branching rules based on email tracking events (opens and clicks) with a configurable evaluation wait window. If a membership reaches an evaluation threshold, the engine evaluates whether they engaged (e.g. opened or clicked the email sent during that step) and dynamically routes them to either a "True" branch or a "False" branch of the sequence.

## 2. Technical Scope
- **Database Schema**:
  - Add `marketing_sequence_step_branches` table under `packages/db/src/schema.ts` to store branching configurations for specific steps.
- **Core Engine Integration**:
  - Update `executePendingSequenceSteps` in `packages/core/src/index.ts` to evaluate active branching rules.
  - If a branch is configured for the step just completed, the engine pauses progress for the `evaluationWindowDays` period.
  - Upon resumption, the engine checks the email tracker's stats (opens or clicks) for that step's email and branches the membership's execution path to either `trueNextStepNumber` or `falseNextStepNumber`.
- **REST Endpoints**:
  - `GET /api/sequences/:id/steps/:stepId/branch` - Retrieves branching rule for a step.
  - `POST /api/sequences/:id/steps/:stepId/branch` - Configures or updates branching rule for a step.
- **Verification**:
  - Comprehensive integration tests in `packages/testing/src/marketing-sequence-branching.test.ts` validating correct path routing, wait period processing, RLS isolation, and audit trail logs.
