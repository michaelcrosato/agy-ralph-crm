# Spec 0132: Account Teams & Collaboration Roles Implementation Plan

## Step 1: Database Schema Modification
- Open `packages/db/src/schema.ts` and append the `accountTeams` table schema definition.
- Export it under appropriate pgTable configurations.

## Step 2: Database Store Extension
- Open `packages/db/src/index.ts`.
- Declare the `accountTeams` interface and type-def.
- In the `dbStore` instantiation block, construct standard CRUD methods for the `accountTeams` entity with active tenant RLS bounds checking.
- Specifically:
  - `findForAccount(accountId: string)`
  - `addOrUpdateMember(accountId: string, userId: string, role: string)`
  - `removeMember(accountId: string, userId: string)`

## Step 3: Core Validation Functions
- Open `packages/core/src/index.ts`.
- Append `SUPPORTED_TEAM_ROLES` and the pure function `validateAccountTeamMember`.
- Re-run `pnpm build` in the core package.

## Step 4: REST API Integration
- Open `apps/api/src/index.ts`.
- Register three endpoints under the `tenantAuth` middleware context:
  - `GET /api/accounts/:id/team`
  - `POST /api/accounts/:id/team`
  - `DELETE /api/accounts/:id/team/:userId`
- Inject appropriate audit log triggers and outbound webhook dispatches (`account.team_updated`).

## Step 5: Integration & RLS Isolation Tests
- Create a test file `packages/testing/src/account-teams.test.ts`.
- Establish multiple organizations to assert strict tenant isolation rules:
  - Assert that Tenant 1 cannot fetch the account team details of Tenant 2's accounts.
  - Assert that Tenant 1 cannot insert or delete team members on Tenant 2's accounts.
  - Verify that adding a member adds a team mapping and triggers the appropriate audit trail entry.
  - Verify updating roles modifies the role correctly.
  - Verify that removing a member removes the mapping.

## Step 6: Workspace Compile & Lint Verification
- Run `pnpm verify` to check type correctness, linter diagnostics, and test results.
- Run `npx biome check --write .` if any lint violations are encountered.
