# Spec 0132: Account Teams & Collaboration Roles Requirements

## 1. Functional Requirements

### Database Schema Expansion
* **R1.1**: The `accountTeams` table must be defined in `packages/db/src/schema.ts` with fields:
  - `id`: uuid, primary key, default random.
  - `orgId`: uuid, not null, referencing `organizations.id` with `onDelete: "cascade"`.
  - `accountId`: uuid, not null, referencing `accounts.id` with `onDelete: "cascade"`.
  - `userId`: uuid, not null, referencing `users.id` with `onDelete: "cascade"`.
  - `role`: text, not null (supported values: `"Account Manager"`, `"Sales Engineer"`, `"Customer Success Manager"`, `"Executive Sponsor"`, `"Other"`).
  - `createdAt`: timestamp, not null, default now.
* **R1.2**: Tenant isolation must be maintained: the `accountId` and `userId` must belong to the same tenant organization (`orgId`).

### Business Logic Core (`packages/core`)
* **R2.1**: **Input Validation**: Implement a function `validateAccountTeamMember(accountId: string, userId: string, role: string): { success: boolean; error?: string }`. It should:
  - Ensure the role is one of the supported values.
  - Validate that `accountId` and `userId` are valid UUIDs.

### Store Engine Expansion (`packages/db`)
* **R3.1**: The `accountTeams` store in `packages/db/src/index.ts` must support:
  - `findForAccount(accountId: string)`: Return all team members for a given account.
  - `addOrUpdateMember(accountId: string, userId: string, role: string)`: Add a new member or update their role if they are already on the team.
  - `removeMember(accountId: string, userId: string)`: Remove a user from the account team.

### REST API Endpoints (`apps/api`)
* **R4.1**: **POST `/api/accounts/:id/team`**:
  - Add or update a team member's role.
  - Required body parameters: `userId` (string, UUID) and `role` (string).
  - Validate role values.
  - Log audit trail entries (`account_team_member_added` or `account_team_member_updated`).
  - Dispatch webhook `account.team_updated`.
* **R4.2**: **GET `/api/accounts/:id/team`**:
  - Fetch all collaborative team members assigned to an account.
  - Ensure tenant isolation (only accounts belonging to the authenticated tenant org can be accessed).
* **R4.3**: **DELETE `/api/accounts/:id/team/:userId`**:
  - Remove a team member from the account.
  - Log audit trail entry (`account_team_member_removed`).
  - Dispatch webhook `account.team_updated`.

### Audit Trail & Webhooks
* **R5.1**: Ensure every change to the account team produces a detailed audit log entry under the `audit_logs` table (referencing the modified account).
* **R5.2**: Fire `account.team_updated` outbound webhook event whenever a team member is added, updated, or removed.

## 2. Security & Tenancy Requirements
* **S1.1**: **Strict RLS Isolation**: A user from Tenant A must be blocked from adding/removing/viewing team members on accounts belonging to Tenant B.
* **S1.2**: Tenant verification must occur via Hono `tenantAuth` middleware context propagation.
