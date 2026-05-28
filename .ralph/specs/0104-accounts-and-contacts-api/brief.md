# Specification: Accounts & Contacts REST API - Brief

## Objective
Establish the Hono REST API endpoints for listing and retrieving Accounts and Contacts. Ensure complete tenant Row-Level Security (RLS) isolation applies to all database queries.

## Boundaries & Constraints
- Accessor operations and persistent entities reside in `packages/db`.
- API endpoints for listing and viewing individual accounts and contacts reside in `apps/api`.
- All routes must be protected via the `tenantAuth` middleware and execute within the active tenant RLS context.
