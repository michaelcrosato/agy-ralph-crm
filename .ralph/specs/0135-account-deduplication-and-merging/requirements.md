# Spec 0135: Account De-duplication and Merging API Requirements

## Functional Requirements

### 1. Duplicate Identification Rules (`calculateAccountDuplicates`)
* **Tenancy**: A search for duplicates of an account MUST be restricted strictly to the active tenant's context.
* **Matching Logic**:
  - Exclude the source account itself.
  - Matches MUST be found based on exact matches of name (trimmed, case-insensitive) OR exact matches of the domain (trimmed, case-insensitive) where the domain is NOT null/empty.
  - Returns a list of matching `Account` records.

### 2. Account Merging Engine (`mergeAccounts`)
* **Input Parameters**:
  - `master`: The target account record to persist.
  - `duplicate`: The duplicate account record to merge and subsequently delete.
  - `fieldResolution`: A map defining the field resolution strategy (e.g., `{"name": "master", "domain": "duplicate"}`).
* **Field Resolution Strategy**:
  - Resolve primary fields (`name`, `domain`) using the resolution map (defaulting to "master" if not provided or invalid).
  - Merge custom JSONB fields:
    - If a key exists only in master, keep master value.
    - If a key exists only in duplicate, keep duplicate value.
    - If a key exists in both, resolve using `custom.<key>` resolution map parameter (falling back to "master" if unspecified).
  - Validation: Verify both accounts belong to the same organization. Throw if there is an organization mismatch.

### 3. REST API Endpoint: `GET /api/accounts/:id/duplicates`
* MUST be protected with `tenantAuth` middleware.
* Retreive the target account. If not found, return `404 Not Found`.
* Scan the active organization's accounts, invoke `calculateAccountDuplicates`, and return the matches.

### 4. REST API Endpoint: `POST /api/accounts/:id/merge`
* MUST be protected with `tenantAuth` middleware.
* Request Body MUST contain:
  - `duplicateId`: The ID of the account to merge and remove.
  - `fieldResolution`: Map containing field-level resolutions.
* Steps to perform:
  - Retrieve the master and duplicate accounts. Return `404` if either doesn't exist or is not in the active organization.
  - Call `mergeAccounts` to calculate the merged record.
  - Save the merged values into the master account record using `dbStore.accounts.update`.
  - **Re-parent Related Child Entities**:
    - **Contacts**: Update all contacts where `accountId === duplicateId` to `accountId = masterId`.
    - **Opportunities**: Update all opportunities where `accountId === duplicateId` to `accountId = masterId`.
    - **Contracts**: Update all contracts where `accountId === duplicateId` to `accountId = masterId`.
    - **Account Teams**: Re-parent account team members. If a user is already in the master's account team, keep the master's role configuration and remove/delete the duplicate account team member to avoid duplicates.
    - **Activity Links**: Update all `activityLinks` where `targetType === 'Account' && targetId === duplicateId` to `targetId = masterId`.
  - Remove the duplicate account from the store using `dbStore.accounts.delete`.
  - Create a detailed `recalculate_score` or `merge_accounts` audit log tracking the changes.
  - Trigger `account.merged` webhook event.
  - Return the updated master account representation with status `200 OK`.

## Row-Level Security & Tenant Isolation
* All operations MUST run under strict active tenant contexts.
* Any attempt by Tenant B to discover duplicates of Tenant A's account or merge Tenant A's accounts MUST fail with `404 Not Found` or an explicit RLS error.
