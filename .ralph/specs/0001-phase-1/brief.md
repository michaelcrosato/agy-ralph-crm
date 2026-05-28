# Phase 1: Identity, Tenancy, & Security Foundation - Brief

## Objective
Establish the primary security architecture for the multi-tenant CRM operating system. This includes registering organizations and users, defining membership structures, managing permission sets, and creating a robust tenant context token parser and a database-level Row-Level Security (RLS) enforcement system.

## Boundaries & Constraints
- Pure domain boundaries must reside in `packages/core`.
- Database configurations, Drizzle schemas, migrations, and session engines must reside in `packages/db`.
- Authentication, session keys, and JWT verification must reside in `packages/auth`.
- Tenancy validation and context-switching must enforce PostgreSQL database-level RLS.
