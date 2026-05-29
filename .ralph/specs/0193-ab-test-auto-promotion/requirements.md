# Specification: Marketing Sequence A/B Test Winner Auto-Promotion Engine - Requirements

## 1. Functional Requirements

### 1.1 Split Test Auto-Promotion Configuration
- Each split test configuration (`marketingSequenceStepSplitTests` table) MUST support three new optional/defaulted fields:
  - `autoPromoteWinner`: An integer indicating if auto-promotion is enabled (0 = disabled, 1 = enabled, defaults to 0).
  - `minSendsToEvaluate`: An integer specifying the minimum total sent emails across both variants (A and B) before an evaluation is triggered (defaults to 10). Must be positive.
  - `evaluationMetric`: A text string indicating the metric to evaluate, either `"open_rate"` or `"click_rate"` (defaults to `"open_rate"`).

### 1.2 Evaluation and Winner Promotion during Execution
- During the `executePendingSequenceSteps` loop, prior to processing a step with an active split test that has `autoPromoteWinner === 1`:
  - Calculate the cumulative performance statistics for both templates:
    - Default Template (A) (`step.templateId`)
    - Variant Template (B) (`splitTest.variantTemplateId`)
  - The calculations MUST retrieve all sequence memberships for the current sequence, find their allocated template for this step via `marketingSequenceAbAllocations`, find their corresponding sent email activity records (using sorted ID alignment: the `step.stepNumber - 1`th email activity for the membership), and read the `openCount` and `clickCount` via `emailTrackers`.
  - Let:
    - `baseSends` = Count of step email activities sent with template A.
    - `baseOpens` = Count of step email activities sent with template A where `tracker.openCount > 0`.
    - `baseClicks` = Count of step email activities sent with template A where `tracker.clickCount > 0`.
    - `variantSends` = Count of step email activities sent with template B.
    - `variantOpens` = Count of step email activities sent with template B where `tracker.openCount > 0`.
    - `variantClicks` = Count of step email activities sent with template B where `tracker.clickCount > 0`.
  - Trigger evaluation ONLY if `(baseSends + variantSends) >= minSendsToEvaluate`.
  - Calculate rates:
    - If `evaluationMetric === "open_rate"`:
      - `baseRate` = `baseOpens / baseSends` (or 0 if `baseSends === 0`)
      - `variantRate` = `variantOpens / variantSends` (or 0 if `variantSends === 0`)
    - If `evaluationMetric === "click_rate"`:
      - `baseRate` = `baseClicks / baseSends` (or 0 if `baseSends === 0`)
      - `variantRate` = `variantClicks / variantSends` (or 0 if `variantSends === 0`)
  - Determine winner:
    - If `variantRate > baseRate`: Variant B is the winner!
      - Update the step's `templateId` to `splitTest.variantTemplateId`.
    - If `baseRate >= variantRate`: Default A is the winner!
      - The step's `templateId` remains `step.templateId`.
  - retire split test:
    - Set the split test's `isActive` to `0` (inactive) in the database.
    - Future memberships executing this step will skip A/B allocation and directly use the promoted `templateId`.
  - Log an audit trail entry:
    - `recordId` = `splitTest.id`
    - `recordType` = `"marketing_sequence_step_split_tests"`
    - `action` = `"auto_promoted"`
    - `changes` = Include details of winner template, metrics (rates and send counts), and new step `templateId`.

### 1.3 REST API Updates
- The endpoints `GET /api/sequences/:id/steps/:stepId/split-test` and `POST /api/sequences/:id/steps/:stepId/split-test` MUST serialise and accept `autoPromoteWinner`, `minSendsToEvaluate`, and `evaluationMetric`.
- Validate payloads:
  - `autoPromoteWinner` must be `0` or `1`.
  - `minSendsToEvaluate` must be a positive integer.
  - `evaluationMetric` must be `"open_rate"` or `"click_rate"`.
  - Return `400 Bad Request` on validation failure.

## 2. Row-Level Security (RLS) & Tenancy Requirements
- All performance queries, split test deactivations, step template promotions, and audit logging MUST strictly operate under active tenant row-level security boundaries.
- One tenant organization MUST NOT be able to view, update, evaluate, or trigger auto-promotions for split tests belonging to another organization.
