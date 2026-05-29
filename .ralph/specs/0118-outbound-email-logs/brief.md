# Task 0118: Outbound Email Log Adapters & Service Activity Integrations - Brief

## Objective
Implement a secure, multi-tenant outbound email logging engine and REST API endpoints. This enables users and external integrations to log manual outbound emails and link them to core CRM entities (Leads, Accounts, Contacts, Opportunities) while strictly enforcing row-level security (RLS) isolation boundaries.

## Scope & Constraints
- **Core Package**: Extend `packages/core` with email-specific helper utilities to validate standard RFC-compliant email logs.
- **Database/Store**: Utilize `activities` and `activityLinks` tables/stores under `packages/db` to persist email metadata and relational target bindings under active tenant RLS context.
- **API Routing**: Register Hono endpoints `/api/emails/log` and `/api/emails/:id` under `apps/api`.
- **Row-Level Security**: Ensure Tenant A can never log or read email activities belonging to Tenant B's context.
