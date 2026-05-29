# Spec 0132: Account Teams & Collaboration Roles Brief

## Objective
Large commercial sales and account management organizations frequently utilize cross-functional teams to service key accounts. For example, a single customer account may require dedication from an Account Manager, a Sales Engineer, a Customer Success Manager, and an Executive Sponsor. To support this collaborative dynamic, we need to introduce **Account Teams and Collaboration Roles** into the CRM Core.

This feature enables assigning multiple users to an account with designated roles, querying account team members, managing team compositions, and tracking adjustments in the system's audit trail. All of this must be enforced under strict multi-tenant Row-Level Security (RLS) isolation so that one tenant's account team details are never visible to another tenant.

## Scope

* **Database & Store Actions (`packages/db`)**:
  - Add the `accountTeams` table schema in `packages/db/src/schema.ts` to map accounts to users with collaborative roles.
  - Expose helper store methods in `packages/db/src/index.ts` to manage account team assignments, query team members, and check roles under active tenant RLS isolation.
* **Core Business Logic (`packages/core`)**:
  - Implement a helper function `validateAccountTeamMember` in `packages/core/src/index.ts` to assert role correctness and prevent duplicate member mappings.
* **REST API Endpoints (`apps/api`)**:
  - `POST /api/accounts/:id/team`: Add or update a team member's role on an account.
  - `GET /api/accounts/:id/team`: Retrieve the list of all collaborative team members assigned to an account.
  - `DELETE /api/accounts/:id/team/:userId`: Remove a team member from an account's team.
* **Audit Trail & Webhooks**:
  - Log audit trail entries when a team member is added, updated, or removed.
  - Dispatch outbound webhooks (`account.team_updated`) when the account team is modified.
* **Row-Level Security**:
  - Ensure that account team details adhere to strict tenant isolation, verifying that a user from one tenant organization cannot view or modify the team composition of an account belonging to another tenant.
