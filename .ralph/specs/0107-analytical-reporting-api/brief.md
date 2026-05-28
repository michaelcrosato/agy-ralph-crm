# Specification: Analytical Reporting & Saved Views REST API - Brief

## Objective
Establish database stores, a query compilation engine inside `packages/reporting`, and Hono REST API endpoints inside `apps/api` for creating, listing, and running saved reports (analytical reporting queries) over CRM records. These reports will allow organizations to group records (by standard or custom fields) and calculate aggregated metrics (e.g. counts, sums, or averages) under strict multi-tenant Row-Level Security (RLS) isolation.

## Boundaries & Constraints
- Database schemas for `reports` and RLS filtering methods reside in `packages/db`.
- Report compilation, aggregation logic, and execution engine reside in `packages/reporting`.
- REST API routes for report definition management and execution reside in `apps/api`.
- All database queries and analytical computations must execute under verified session authorization and tenant RLS isolation contexts.
