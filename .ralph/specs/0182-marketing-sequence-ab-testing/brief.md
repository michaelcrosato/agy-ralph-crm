# Specification: Marketing Sequence A/B Split Testing Engine - Brief

## 1. Functional Objective
A/B testing is vital for optimizing marketing sequences (drip journeys). This feature introduces an automated A/B split testing engine within Marketing Sequences.
Marketing managers can configure specific steps of a sequence to A/B test different email templates. When a membership reaches an A/B test step, they are dynamically allocated to either Version A (the default template) or Version B (the variant template) using a randomized percentage weight split (e.g. 50/50).
The system tracks split-test allocations to ensure a consistent experience for members and record analytics.

## 2. Technical Scope
- **Database Schema**:
  - Add `marketing_sequence_step_split_tests` to specify variants for steps.
  - Add `marketing_sequence_ab_allocations` to persist allocation choices for each member and step.
- **Core Integration**: Update sequence execution to check if a step has active split testing configured. If so:
  - Check if the member already has an allocation for this step. If not, dynamically allocate them (randomly based on weight) and persist it.
  - Dispatch the allocated email template and log the corresponding activity.
- **REST Endpoints**:
  - `GET /api/sequences/:id/steps/:stepId/split-test` - Retrieves split test configuration for a step.
  - `POST /api/sequences/:id/steps/:stepId/split-test` - Sets/configures split test for a step.
  - `POST /api/sequences/:id/steps/:stepId/split-test/allocate` - Manually tests or pre-allocates split test.
- **Verification**: Integration tests asserting allocation logic, consistency, tenant RLS isolation, and correct execution flow.
