# Spec 0126: Lead De-duplication and Merging API Requirements

## Functional Requirements

### 1. Duplicate Identification Rules
The duplicate engine must identify another lead as a duplicate of a source lead if:
* They belong to the same active organization (`orgId` matches).
* Their IDs are different.
* Either of the following conditions is met:
  1. The emails match exactly (case-insensitive, ignoring surrounding whitespace).
  2. The company names match exactly (case-insensitive, ignoring surrounding whitespace) **AND** the email domains are identical (e.g., both are `google.com`, ignoring common public domains like `gmail.com`, `yahoo.com`, `outlook.com` to prevent false positives).

### 2. Merging and Field Conflict Resolution
When merging a duplicate lead into a master lead:
* The user must specify a field resolution map indicating for each standard field (`email`, `company`, `status`) whether to retain the `master` value or overwrite it with the `duplicate` value.
* Custom fields (`custom` JSONB object) must be merged:
  - If a custom field key is present only in one lead, it is kept in the merged lead.
  - If a custom field key is present in both, the value is resolved using the specified resolution map.
* The merged lead is updated with the resolved values.
* The duplicate lead is physically deleted from the active leads collection.

### 3. Consolidation of Child Entities
* **Activity Links**: All activity links associated with the duplicate lead (`targetType` is "Lead" and `targetId` matches duplicate ID) must be updated to reference the master lead ID.
* **Campaign Memberships**:
  - If the duplicate lead is a member of a campaign that the master lead is **not** a member of, the membership must be updated to point to the master lead.
  - If the master lead is already a member of that campaign, the duplicate lead's membership must be deleted.

### 4. Audit Trail & Notifications
* An audit log entry must be created for the master lead indicating an `update` action, listing the merged fields and the ID of the duplicate lead that was merged.
* An outbound webhook event `lead.merged` must be triggered containing the master lead's final details, the duplicate lead's ID, and the organization ID.

## Non-Functional & Security Requirements
* **Strict Tenant Isolation**: All duplicate checking and merging operations must operate under the `tenantAuth` middleware context, ensuring that a user can never see or merge leads belonging to another organization. Any attempt to access or merge cross-tenant leads must throw an RLS isolation error or return a `404 Not Found`.
* **TypeScript & Biome Compliance**: All codebase modifications must be type-safe, pass TypeScript compilation, and meet all Biome linting and formatting rules cleanly.
