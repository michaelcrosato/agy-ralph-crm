# Task 0121: Lead Assignment Rules & Auto-Routing Engine - Brief

## Objective
Implement an automated lead assignment and routing engine with active tenant RLS isolation. This feature allows CRM administrators to define set routing rules with sequenced criteria entries (e.g., routing based on geographic region, company size, or custom fields) to automatically assign newly created or incoming leads to specific sales representatives or distribute them via a Round-Robin queue.

## Scope & Constraints
- **Core Package**: Extend `packages/core` with a stateless routing/criteria evaluation engine. It must support matching Lead records against a set of field criteria (supporting field comparisons for standard fields like `email`, `company` and dynamic `custom` field values) and support both Direct and Round-Robin assignments.
- **Database/Store**: Define `lead_assignment_rules` and `lead_assignment_rule_entries` schemas under `packages/db` and implement active tenant RLS context isolation in the mock store collections.
- **API Routing**: Register Hono REST endpoints in `apps/api` for:
  - Creating and updating lead assignment rules (`POST /api/lead-assignment-rules`, `PUT /api/lead-assignment-rules/:id`).
  - Listing active tenant rules (`GET /api/lead-assignment-rules`).
  - Executing rule routing on a specific Lead record (`POST /api/leads/:id/assign`), which evaluates active rules and updates the Lead's ownerId.
- **Audit Trails**: Recording an immutable entry in the `audit_logs` store whenever a lead's ownership is automatically updated via rules.
- **Row-Level Security**: Ensure Tenant A can never view, manage, or execute lead assignment rules belonging to Tenant B's context, and Tenant A's leads cannot be assigned to Tenant B's users.
