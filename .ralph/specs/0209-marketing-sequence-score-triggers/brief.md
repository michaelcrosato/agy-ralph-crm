# Specification: Marketing Sequence Score-Based Automation Triggers - Brief

## 1. Functional Objective
To enable modern enterprise marketing teams to execute automated actions when a recipient's engagement score reaches a key threshold, this feature introduces **Task 0209: Marketing Sequence Score-Based Automation Triggers Engine**.
While the system currently calculates and updates a composite `engagementScore` for each sequence member (Task 0208) in real-time, it does not act on this score automatically.

This feature enables the CRM to:
1. Define score-based triggers for any marketing sequence, specifying an `engagementScore` threshold and an action to take when that threshold is met or exceeded.
2. Store score triggers in a secure, tenant-isolated `marketingSequenceScoreTriggers` store.
3. Automatically execute triggers in real-time when a sequence membership's `engagementScore` is recalculated.
4. Support three core high-value actions:
   - `"change_lead_status"`: Update the lead's status to a target value (e.g., `"Qualified"` or `"Hot"`).
   - `"auto_exit"`: Transition the membership status to `"completed"` to stop further automated sequence steps.
   - `"notify_owner"`: Automatically create a CRM task assigned to the lead/contact's owner to trigger follow-up.
5. Expose tenant-protected API endpoints for managing triggers (create, retrieve, delete).

## 2. Technical Scope
- **Database Schema**:
  - Implement a new database model and interface `DBMarketingSequenceScoreTrigger` in `packages/db`.
  - Add the `marketingSequenceScoreTriggers` store under `dbStore` with standard multi-tenant RLS checks.
- **Core Engine Integration**:
  - Implement a core utility `processSequenceMembershipScoreTriggers(membershipId)` in `packages/core`.
  - Integrate it with `recalculateMemberEngagementScore` so triggers evaluate automatically upon score recalculation.
- **REST Endpoints**:
  - Expose `POST /api/sequences/:id/triggers` under `apps/api` (tenant-protected).
  - Expose `GET /api/sequences/:id/triggers` under `apps/api` (tenant-protected).
  - Expose `DELETE /api/sequences/triggers/:id` under `apps/api` (tenant-protected).
- **Tests**:
  - Write comprehensive integration tests in `packages/testing/src/marketing-sequence-score-triggers.test.ts` asserting trigger execution, RLS boundaries, and correct audit/task creation.
