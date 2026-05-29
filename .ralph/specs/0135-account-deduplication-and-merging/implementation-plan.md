# Spec 0135: Account De-duplication and Merging API Implementation Plan

## Phase 1: Database and Core Functions

### Step 1: Update DB Package (`packages/db/src/index.ts`)
* Add `delete` method to `dbStore.accounts` under tenant context RLS isolation.
* Export any new types if required.

### Step 2: Implement Core Algorithms (`packages/core/src/index.ts`)
* Define `AccountRecord`, `FieldResolutionSource`, `MergeAccountsInput` types.
* Implement `calculateAccountDuplicates` to identify potential duplicate accounts by matching name or domain.
* Implement `mergeAccounts` to merge master and duplicate records based on field resolution mapping.
* Export all new types and functions.

## Phase 2: REST API Routes

### Step 3: Implement Hono Route Handlers (`apps/api/src/index.ts`)
* Add imports for `calculateAccountDuplicates` and `mergeAccounts` from `@crm/core`.
* Implement `GET /api/accounts/:id/duplicates` protecting it with `tenantAuth` middleware.
* Implement `POST /api/accounts/:id/merge` protecting it with `tenantAuth` middleware.
* Inside merge route:
  - Retrieve master and duplicate records, performing active tenant RLS checks.
  - Compute merged values using `mergeAccounts`.
  - Update master account record.
  - Re-parent related Contacts, Opportunities, Contracts, and Activity Links.
  - Re-parent or clean up related Account Team Members.
  - Delete duplicate account record.
  - Create audit log entry tracking the merge.
  - Trigger outbound webhook `account.merged`.
  - Return updated master account.

## Phase 3: Verification & Integration Tests

### Step 4: Write Integration Tests (`packages/testing/src/account-deduplication.test.ts`)
* Test duplicate checking logic across different scenarios (name match, domain match).
* Test successful merging of primitive fields and custom metadata fields.
* Assert child records (contacts, opportunities, activities, contracts, and team memberships) are correctly consolidated and re-parented.
* Test RLS boundary checks—insulating Tenant A from viewing or merging Tenant B's accounts.
* Verify using `pnpm verify`.
