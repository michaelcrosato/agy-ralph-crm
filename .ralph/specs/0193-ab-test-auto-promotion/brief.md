# Specification: Marketing Sequence A/B Test Winner Auto-Promotion Engine - Brief

## 1. Functional Objective
In enterprise marketing platforms, running A/B split tests indefinitely is inefficient and delays campaign optimization. Once a statistically significant number of interactions has been recorded, the higher-performing variant should be automatically promoted to be the default step template, and the split test should be retired.
This task introduces **Task 0193: Marketing Sequence A/B Test Winner Auto-Promotion Engine**. It allows users to specify automatic promotion criteria on sequence step split tests. When the configured minimum number of sent emails for a split test is reached, the scheduler evaluates open/click performance, promotes the winning template as the new default for the sequence step, deactivates the split test, and logs a comprehensive audit trail entry.

## 2. Technical Scope
- **Database Schema Upgrades**:
  - Update `marketing_sequence_step_split_tests` table under `packages/db` to support:
    - `autoPromoteWinner: integer("auto_promote_winner")` (0 = disabled, 1 = enabled)
    - `minSendsToEvaluate: integer("min_sends_to_evaluate")` (positive integer)
    - `evaluationMetric: text("evaluation_metric")` (e.g. `"open_rate"` or `"click_rate"`)
  - Update corresponding TypeScript interfaces and mock databases inside `packages/db`.
- **Core Execution Engine Upgrades**:
  - Update `executePendingSequenceSteps` loop in `packages/core` to check for active split tests with auto-promotion enabled.
  - Prior to assigning a template variant for the current membership, evaluate if the total sent emails for this split test has reached or exceeded `minSendsToEvaluate`.
  - Calculate sent counts, opens, and clicks for both default (A) and variant (B) templates using sequence memberships, email activity records, and email trackers.
  - If the threshold is reached, determine the winner based on the configured `evaluationMetric`:
    - Variant B wins if its metric rate is strictly higher than default A.
    - Default A remains (and variant B is retired) if its metric rate is higher than or equal to variant B's rate.
  - Perform the promotion:
    - Update the sequence step's `templateId` to the winning template.
    - Deactivate the split test (`isActive = 0`).
    - Insert a `split_test_promoted` or `split_test_winner_determined` audit log indicating winner details and performance metrics.
- **API and REST Gateways**:
  - Update Hono API split test endpoints in `apps/api` (both `GET` and `POST` for split test configurations) to validate and serialize `autoPromoteWinner`, `minSendsToEvaluate`, and `evaluationMetric`.
- **Verification and RLS Tests**:
  - Write robust integration and RLS tests inside `packages/testing/src/marketing-sequence-ab-promotion.test.ts` to assert correct performance calculation, automated winner promotion, database state transitions, and tenant RLS isolation.
