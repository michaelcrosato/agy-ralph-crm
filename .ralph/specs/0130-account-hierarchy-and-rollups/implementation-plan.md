# Spec 0130: Account Hierarchy & Consolidated Opportunity Rollups Implementation Plan

## Step 1: Database Schema Modification
- Open `packages/db/src/schema.ts`.
- Locate the `accounts` table definition.
- Add `parentAccountId` column. Ensure self-referencing references `accounts.id` with a functional foreign key mapping to resolve circular runtime dependencies.

## Step 2: Store Engine Expansion
- Open `packages/db/src/index.ts`.
- Add `parentAccountId` to the `accounts` select/insert/update columns structure and mock store logic.
- Add custom methods to `accounts` store implementation (`findChildren`, `findParentPath`) under the isolated RLS context.

## Step 3: Core Calculations Implementation
- Open `packages/core/src/index.ts`.
- Implement `detectCircularAccountRelation` function protecting against circular assignments.
- Implement `rollupHierarchyPipeline` compiling active and closed-won pipelines across all nested accounts in a branch.
- Export functions and associated interfaces.

## Step 4: REST API Endpoints Scaffolding
- Open `apps/api/src/index.ts`.
- Update `PATCH /api/accounts/:id` endpoint:
  - If `parentAccountId` is provided, verify ownership under RLS tenant context.
  - Run the `detectCircularAccountRelation` check.
  - Return `400 Bad Request` if cycle detected.
  - Register `account.hierarchy_updated` webhook event trigger and insert audit log record for `changes.parentAccountId`.
- Scaffaffold new routes:
  - `GET /api/accounts/:id/hierarchy`: Resolves parents path and direct children.
  - `GET /api/accounts/:id/consolidated-pipeline`: Compiles pro-rated rollup pipeline.

## Step 5: Integration & RLS Isolation Tests
- Create `packages/testing/src/account-hierarchy.test.ts`.
- Assert standard CRUD operations work seamlessly with `parentAccountId`.
- Assert cycle-preventative validation blocks circular linkages.
- Assert rollup pipeline calculates correct sums across complex nested architectures.
- Assert strict RLS tenant isolation (Tenant A cannot link Account to Tenant B's Account).

## Step 6: Verification Gate Verification
- Run `pnpm verify` to trigger Biome linter, TypeScript compiler, and Vitest suite execution.
- If type check or linting warnings arise, repair them until clean build outputs are achieved.

## Step 7: Git Commit Completed Feature
- Stage files: `git add .`
- Commit: `feat(accounts): implement Account Hierarchies and Consolidated Opportunity Rollups API, RLS tests (task 0130)`
