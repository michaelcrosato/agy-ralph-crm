# Task 0122: Sales Territories & Account Routing Engine - Brief

## Objective
Implement a Sales Territory Management and Account Auto-Assignment Engine with active tenant RLS isolation. This feature allows CRM administrators to define geographic or business-level Territories (e.g. based on country, state, industry, or revenue), assign sales representatives to those territories, and automatically route and assign newly created or updated Accounts to the appropriate territory and owner.

## Scope & Constraints
- **Core Package**: Extend `packages/core` with a territory matching and evaluation utility. It must support matching Account records against territory criteria (e.g., country, state, industry, revenue threshold, or dynamic custom fields) and assigning correct ownership or territory tags.
- **Database/Store**: Define `territories` and `territory_members` schemas under `packages/db` and implement active tenant RLS context isolation in the mock store collections.
- **API Routing**: Register Hono REST endpoints in `apps/api` for:
  - Creating and updating territories (`POST /api/territories`, `PUT /api/territories/:id`).
  - Listing active tenant territories (`GET /api/territories`).
  - Managing territory members (`POST /api/territories/:id/members`, `DELETE /api/territories/:id/members/:userId`).
  - Executing territory routing on a specific Account record (`POST /api/accounts/:id/route`), which evaluates active territories and updates the Account's ownerId and territory fields.
- **Audit Trails**: Recording an immutable entry in the `audit_logs` store whenever an account's ownership/territory is automatically updated via routing rules.
- **Row-Level Security**: Ensure Tenant A can never view, manage, or assign territories belonging to Tenant B's context, and Tenant A's accounts cannot be routed to Tenant B's users.
