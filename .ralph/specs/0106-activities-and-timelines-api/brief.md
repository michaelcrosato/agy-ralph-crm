# Specification: Activities & Chronological Task Timelines REST API - Brief

## Objective
Establish database stores and Hono REST API endpoints for managing activities (Tasks, Calls, Notes, and Emails) and linking them to standard CRM records (Accounts, Contacts, Leads, and Opportunities) under strict multi-tenant Row-Level Security (RLS) isolation. Enable retrieving a chronological consolidated activity timeline for any individual target record.

## Boundaries & Constraints
- Persistent activity entities, target links, and RLS filtering methods reside in `packages/db`.
- API endpoints for creating, retrieving, and fetching target timelines reside in `apps/api`.
- All database queries and REST operations must run under verified session authorization and tenant RLS wrappers enforced by the Hono `tenantAuth` middleware.
