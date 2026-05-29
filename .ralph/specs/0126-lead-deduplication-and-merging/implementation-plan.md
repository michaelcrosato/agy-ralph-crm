# Spec 0126: Lead De-duplication and Merging API Implementation Plan

## Phase 1: Database and Core Functions

### Step 1: Update DB Package (`packages/db/src/index.ts`)
* Add `delete` method to `dbStore.leads`.
* Ensure it executes active org RLS isolation checks, throwing an error on cross-tenant mismatch.

### Step 2: Implement Core Algorithms (`packages/core/src/index.ts`)
* Implement `calculateLeadDuplicates` to detect exact email matches or exact company + matching email domain matches.
* Implement `mergeLeads` to resolve primitive and custom fields according to a resolution map.
* Export all new types and functions.

## Phase 2: REST API Routes

### Step 3: Implement Hono Route Handlers (`apps/api/src/index.ts`)
* Add imports for `calculateLeadDuplicates` and `mergeLeads`.
* Implement `GET /api/leads/:id/duplicates` protecting it with `tenantAuth`.
* Implement `POST /api/leads/:id/merge` protecting it with `tenantAuth`.
* Merge logic must handle:
  - Validating master and duplicate leads.
  - Updating master lead.
  - Merging campaign members and activity links.
  - Deleting duplicate lead.
  - Inserting audit log.
  - Triggering `lead.merged` webhooks.

## Phase 3: Verification & Integration Tests

### Step 4: Write Integration Tests (`packages/testing/src/lead-deduplication.test.ts`)
* Test duplicate checking logic across different scenarios (same email, same company + domain, ignoring public domains).
* Test successful merging of primitives and custom field metadata.
* Assert child records (activities, campaign memberships) are correctly consolidated.
* Test RLS boundary checks—insulating Tenant A from viewing or merging Tenant B's duplicates.
* Verify using `pnpm verify`.
