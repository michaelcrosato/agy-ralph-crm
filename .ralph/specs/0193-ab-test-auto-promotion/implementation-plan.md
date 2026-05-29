# Specification: Marketing Sequence A/B Test Winner Auto-Promotion Engine - Implementation Plan

We will implement this task in the following step-by-step sequence:

## Step 1: Packages Database Upgrades
1. Edit `packages/db/src/schema.ts` to add the new columns to the `marketingSequenceStepSplitTests` table:
   - `autoPromoteWinner: integer("auto_promote_winner").notNull().default(0)`
   - `minSendsToEvaluate: integer("min_sends_to_evaluate").notNull().default(10)`
   - `evaluationMetric: text("evaluation_metric").notNull().default("open_rate")`
2. Edit `packages/db/src/index.ts` to extend the `DBMarketingSequenceStepSplitTest` interface and update mock database insertion schemas to default these fields.

## Step 2: Core Logic Updates
1. Edit `packages/core/src/index.ts` to add the fields to the `CoreStepSplitTest` interface:
   - `autoPromoteWinner: number;`
   - `minSendsToEvaluate: number;`
   - `evaluationMetric: string;`
2. Insert A/B Auto-Promotion winner determination logic inside `executePendingSequenceSteps` prior to standard A/B random allocation.
3. If the minimum threshold of sends is met, update the step's default `templateId`, deactivate the split test, and record a `"auto_promoted"` audit log entry.

## Step 3: REST API Updates
1. Update `POST /api/sequences/:id/steps/:stepId/split-test` in `apps/api/src/index.ts` to serialize and validate the three new configuration attributes. Return `400 Bad Request` if payload violates type rules or bounds.

## Step 4: Integration and RLS Tests
1. Create `packages/testing/src/marketing-sequence-ab-promotion.test.ts`.
2. Write comprehensive integration tests verifying:
   - Random allocation works normally if total sends < threshold.
   - Deactivates split test and promotes the correct winner template once total sends >= threshold.
   - Assert base wins if base performance >= variant.
   - Assert variant wins if variant performance > base.
   - Verify audit logs contain details of metrics and winner selection.
   - RLS isolation: Tenant B cannot query Tenant A's auto-promotion configs or bypass validations.
