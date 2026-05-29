# Spec 0136: Contact De-duplication and Merging API Implementation Plan

## Steps to Execute

### Step 1: Implement Core Methods in `packages/core`
* Open `packages/core/src/index.ts`.
* Implement `calculateContactDuplicates` and `mergeContacts` functions matching the signatures and rules defined in `design.md` and `requirements.md`.
* Export the new types and functions from `packages/core/src/index.ts`.

### Step 2: Implement Store Operations in `packages/db`
* Open `packages/db/src/index.ts`.
* Add `delete` method to the `contacts` store object to allow physical deletion of a contact record under tenant organization RLS check.
* Ensure code is cleanly exported.

### Step 3: Implement Hono REST Endpoints in `apps/api`
* Open `apps/api/src/index.ts`.
* Implement route `GET /api/contacts/:id/duplicates` using `tenantAuth` middleware.
* Implement route `POST /api/contacts/:id/merge` using `tenantAuth` middleware.
  - Retrieve contacts, verify tenant.
  - Call `mergeContacts`.
  - Update master contact in DB.
  - Re-parent Tickets, Campaign Members, Opportunity Contact Roles, Activity Links, and reportsToId references.
  - Delete duplicate contact from DB.
  - Log audit logs.
  - Trigger `contact.merged` outbound webhook.

### Step 4: Write Integration & RLS Isolation Tests
* Create `packages/testing/src/contact-deduplication.test.ts`.
* Add comprehensive test cases:
  - Find duplicates based on email exact match.
  - Find duplicates based on name match (first + last).
  - Merge duplicate contact into master with field resolutions.
  - Consolidate and re-parent child tickets, campaign memberships, contact roles, and activities.
  - Enforce tenant isolation / RLS during duplicates query and merge.

### Step 5: Verify the Workspace
* Run `pnpm verify` to check compilation and linter.
* Run `pnpm test` to execute all tests (including new contact de-duplication tests).
