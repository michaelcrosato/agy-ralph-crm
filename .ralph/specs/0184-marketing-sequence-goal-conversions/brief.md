# Specification: Marketing Sequence Conversion Goals & Attribution Engine - Brief

## 1. Functional Objective
In marketing automation, drip sequences are designed to drive specific customer actions (e.g. qualifying a lead, booking a meeting, or creating a new opportunity). Marketing and sales teams need a robust way to define these success criteria as "Goals", dynamically track when enrolled members achieve them, and calculate sequence-level conversion metrics and revenue attribution.

This feature introduces a Marketing Sequence Goals & Attribution Engine to the CRM.
Marketing managers can configure sequence-level Conversion Goals based on record changes (e.g. Lead status transitions or Opportunity creation). When a membership achieves the goal, the engine automatically:
1. Marks the membership status as `"converted"`.
2. Records a conversion entry in a new `marketing_sequence_conversions` table.
3. Associates the conversion with any generated revenue (e.g. Opportunity value) for multi-touch ROI attribution.

## 2. Technical Scope
- **Database Schema**:
  - Add `marketing_sequence_goals` table under `packages/db/src/schema.ts` to store goal rules for sequences.
  - Add `marketing_sequence_conversions` table under `packages/db/src/schema.ts` to log dynamic conversion events and revenue attribution.
- **Core Engine Integration**:
  - Implement a `evaluateSequenceGoals` engine in `packages/core/src/index.ts` that checks active memberships and evaluates if they have achieved the configured conversion goals.
  - Integrate goal evaluation into the sequence background worker (`executePendingSequenceSteps`) and lead conversion updates.
  - Automatically calculate key metrics: Conversion Rate, Total Attributed Revenue, and Average Days to Convert.
- **REST Endpoints**:
  - `GET /api/sequences/:id/goals` - Retrieves configured goals for a sequence.
  - `POST /api/sequences/:id/goals` - Creates or updates conversion goals for a sequence.
  - `GET /api/sequences/:id/conversion-analytics` - Retrieves total conversion metrics, attribution values, and performance indicators.
- **Verification**:
  - Comprehensive integration tests in `packages/testing/src/marketing-sequence-conversions.test.ts` validating correct goal matching, revenue attribution, RLS tenant isolation, and audit trail logs.
