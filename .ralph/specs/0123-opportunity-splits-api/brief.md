# Task 0123: Opportunity Splits & Multi-Rep Commission Allocation - Brief

## Objective
Implement an Opportunity Splits and Multi-Representative Commission Allocation engine with active tenant RLS isolation. This feature allows sales teams to collaborate on deals and split opportunity amounts/credits between multiple sales representatives (e.g. 60% to Account Executive, 40% to Sales Engineer). The core commission engine must automatically calculate and allocate sales commission payouts for each split participant upon deal closure, based on their split credit.

## Scope & Constraints
- **Core Package**: Extend `packages/core` with opportunity split validation and calculation logic. Add split-aware commission calculation functions.
- **Database/Store**: Define `opportunity_splits` schema under `packages/db` and implement active tenant RLS isolation and helper methods in the mock store.
- **API Routing**: Register Hono REST endpoints in `apps/api` for:
  - Defining splits on a specific Opportunity (`POST /api/opportunities/:id/splits`).
  - Retrieving splits for a specific Opportunity (`GET /api/opportunities/:id/splits`).
  - Deleting/resetting splits for an Opportunity (`DELETE /api/opportunities/:id/splits`).
- **Commissions Integration**: When opportunity splits are set/updated:
  - Automatically calculate split amounts.
  - Delete old commission records for the opportunity and insert new split commission records for each split representative (if the opportunity is "Closed Won").
- **Row-Level Security**: Ensure Tenant A can never view, define, or delete opportunity splits belonging to Tenant B, and splits can only reference users and opportunities within the active tenant context.
