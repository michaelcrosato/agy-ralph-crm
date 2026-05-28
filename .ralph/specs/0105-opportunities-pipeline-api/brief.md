# Specification: Opportunities Pipeline & Stage Management REST API - Brief

## Objective
Establish Hono REST API endpoints for managing Opportunities in the sales pipeline under strict tenant Row-Level Security (RLS) isolation. Enable creating, listing, retrieving, and updating sales opportunities (specifically their pipeline stage and sales amount), which seamlessly triggers relevant Event-Condition-Action (ECA) workflow rules.

## Boundaries & Constraints
- Database store access and RLS isolation contexts reside in `packages/db`.
- API endpoints reside in `apps/api`.
- Stage updates on opportunities must invoke the active workflow engine to trigger downstream automations.
- All endpoints must be secured using the Hono `tenantAuth` middleware to prevent cross-tenant data access.
