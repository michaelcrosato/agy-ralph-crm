# Specification: Campaign Email Blast API - Implementation Plan

## Step 1: Update Database Layer
- Locate `packages/db/src/index.ts`.
- Update `DBActivityLink` targetType string union to include `"Campaign"`.
- Verify no TypeScript compiler errors in the `packages/db` package.

## Step 2: Implement Campaign Email Blast Endpoint in Hono API
- Open `apps/api/src/index.ts`.
- Locate the Campaign endpoints section (around line 5950).
- Add the `POST /api/campaigns/:id/email-blast` route containing the personalized bulk email compilation, activity creation, linking, member status updating, and audit log generation logic.
- Ensure all queries are completely isolated under the active tenant's `orgId` (retrieved from `c.get("tenant")`).

## Step 3: Write Integration Test Suite
- Create a new test file `packages/testing/src/campaign-email-blast.test.ts`.
- Write thorough integration tests that:
  - Verify that a campaign email blast compiles and personalizes email subject/body for both Lead and Contact members.
  - Verify that associated Accounts and Opportunities are correctly fetched and their merge fields resolved.
  - Assert that correct Activities of type `"email"`, target Links, and Audit Logs are generated.
  - Assert that campaign member statuses are updated to `"Sent"`.
  - Assert strict multi-tenant row-level security (RLS) isolation boundaries (e.g. Tenant B cannot trigger Tenant A's campaign, Tenant A's campaign blast cannot view Tenant B's contacts/opportunities, Tenant B cannot fetch Tenant A's activity logs).

## Step 4: Verify Workspace and Commit
- Run `pnpm verify` to check type correctness, linting rules, and vitest suites.
- Commit all changes to git.
