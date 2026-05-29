# Specification: Sales Pipeline Stalled Alerts API - Brief

## 1. Functional Objective
To optimize sales velocity and prevent pipeline leakage, enterprise CRMs must identify "stalled" opportunities—deals that have remained in their current stage for longer than expected. Currently, while the CRM tracks stage history, there is no centralized engine or REST API that calculates, reports, and flags stalled opportunities based on tenant-specific age thresholds.

This feature introduces the **Sales Pipeline Stalled Alerts API**. The system will:
1. Allow tenants to define custom stage duration thresholds (in days) per opportunity stage via `opportunity_stage_duration_rules`.
2. Monitor all active (non-closed) opportunities for the tenant.
3. Calculate the duration (in days) each active opportunity has spent in its current stage using the `opportunity_stage_history` log.
4. Flag opportunities as "stalled" if their stage age exceeds the defined threshold for that stage (falling back to sensible default thresholds if no custom rule is defined).
5. Expose REST endpoints to retrieve stalled opportunities and manage stage duration rules under strict active tenant Row-Level Security (RLS) isolation.

## 2. Technical Scope
- **Database Schema**:
  - Add `opportunity_stage_duration_rules` to `packages/db/src/schema.ts` and in-memory store in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `calculateStalledOpportunities` in `packages/core` that processes opportunities, stage histories, and duration rules, and identifies stalled opportunities with calculated duration metrics.
- **REST Endpoints**:
  - `GET /api/opportunities/stalled` - Lists all stalled opportunities for the active tenant.
  - `GET /api/opportunities/stalled/rules` - Lists custom stage duration rules.
  - `POST /api/opportunities/stalled/rules` - Creates or updates a stage duration rule.
- **Tenant RLS & Security**:
  - Ensure all database queries and REST actions run strictly within the active tenant's context. A tenant must never see another's stalled opportunities or rules.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/stalled-deals.test.ts` validating mathematical accuracy and multi-tenant RLS isolation.
