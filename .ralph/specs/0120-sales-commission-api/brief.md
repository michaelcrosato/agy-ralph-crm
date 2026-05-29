# Task 0120: Sales Commission Calculation & Attainment Tracking - Brief

## Objective
Implement a secure, multi-tenant sales commission calculation engine and REST API endpoints. This enables organizations to automate sales representative payouts based on closed-won opportunities, quota attainment tiers, and performance multipliers, while strictly enforcing row-level security (RLS) isolation boundaries.

## Scope & Constraints
- **Core Package**: Extend `packages/core` with pure, stateless commission calculation helper utilities. It will take opportunity details, active quotas, and current attainment status to compute commissions with tiered multipliers.
- **Database/Store**: Define the `commissions` schema in `packages/db` and implement active tenant RLS context isolation in the mock store collections.
- **API Routing**: Register Hono REST endpoints in `apps/api` for:
  - Triggering commission calculations on closed opportunities (`POST /api/commissions/calculate`).
  - Listing active tenant commissions (`GET /api/commissions`).
  - Approving a commission record (`POST /api/commissions/:id/approve`).
- **Audit Trails**: Every calculation and approval state mutation must record an immutable entry in the `audit_logs` store.
- **Row-Level Security**: Ensure Tenant A can never calculate, read, or approve commission records belonging to Tenant B's context.
