# Task 0119: Multi-Stage Opportunity Approval Processes - Brief

## Objective
Implement a secure, multi-tenant opportunity approval process and REST API endpoints. This enables users to submit sales opportunities above a certain threshold (or meeting criteria) for multi-stage approval from roles like managers and VPs, while enforcing strict Row-Level Security (RLS) isolation boundaries.

## Scope & Constraints
- **Core Package**: Extend `packages/core` with business logic to validate opportunity approval submissions (e.g. check stage status and require positive amounts).
- **Database/Store**: Define `opportunity_approvals` and `opportunity_approval_steps` schemas in `packages/db` and implement active tenant RLS context isolation in their mock store collections.
- **API Routing**: Register Hono REST endpoints in `apps/api` for submitting approvals, deciding steps (approve/reject), and retrieving opportunity approval history.
- **Auto-Transition**: When all steps are approved, auto-transition the opportunity to `Closed Won`. If any step is rejected, auto-transition the opportunity to `Closed Lost` and audit the changes.
- **Row-Level Security**: Ensure Tenant A can never submit, read, or decide approval records belonging to Tenant B's context.
