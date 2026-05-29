# Spec 0136: Contact De-duplication and Merging API Requirements

## Functional Requirements

### 1. Duplicate Identification Rules (`calculateContactDuplicates`)
* **Tenancy**: A search for duplicates of a contact MUST be restricted strictly to the active tenant's context.
* **Matching Logic**:
  - Exclude the source contact itself.
  - Matches MUST be found based on exact matches of email (trimmed, case-insensitive, where the email is NOT null/empty) OR exact matches of the combination of firstName AND lastName (both trimmed, case-insensitive, where both are NOT null/empty).
  - Returns a list of matching `Contact` records.

### 2. Contact Merging Engine (`mergeContacts`)
* **Input Parameters**:
  - `master`: The target contact record to persist.
  - `duplicate`: The duplicate contact record to merge and subsequently delete.
  - `fieldResolution`: A map defining the field resolution strategy (e.g., `{"firstName": "master", "lastName": "master", "email": "duplicate"}`).
* **Field Resolution Strategy**:
  - Resolve primary fields (`firstName`, `lastName`, `email`, `accountId`, `reportsToId`) using the resolution map (defaulting to "master" if not provided or invalid).
  - Merge custom JSONB fields:
    - If a key exists only in master, keep master value.
    - If a key exists only in duplicate, keep duplicate value.
    - If a key exists in both, resolve using `custom.<key>` resolution map parameter (falling back to "master" if unspecified).
  - Validation: Verify both contacts belong to the same organization. Throw if there is an organization mismatch.

### 3. REST API Endpoint: `GET /api/contacts/:id/duplicates`
* MUST be protected with `tenantAuth` middleware.
* Retrieve the target contact. If not found, return `404 Not Found`.
* Scan the active organization's contacts, invoke `calculateContactDuplicates`, and return the matches.

### 4. REST API Endpoint: `POST /api/contacts/:id/merge`
* MUST be protected with `tenantAuth` middleware.
* Request Body MUST contain:
  - `duplicateId`: The ID of the contact to merge and remove.
  - `fieldResolution`: Map containing field-level resolutions.
* Steps to perform:
  - Retrieve the master and duplicate contacts. Return `404` if either doesn't exist or is not in the active organization.
  - Call `mergeContacts` to calculate the merged record.
  - Save the merged values into the master contact record using `dbStore.contacts.update`.
  - **Re-parent Related Child Entities**:
    - **Tickets**: Update all tickets where `contactId === duplicateId` to `contactId = masterId`.
    - **Campaign Members**: Re-parent campaign members. If a contact is already a member of a campaign, keep the master's status and remove the duplicate campaign member to avoid duplicate entries.
    - **Opportunity Contact Roles**: Re-parent opportunity contact roles. If a contact already has a role on an opportunity, keep the master's role configuration and remove/delete the duplicate to avoid duplicates.
    - **Activity Links**: Update all `activityLinks` where `targetType === 'Contact' && targetId === duplicateId` to `targetId = masterId`.
    - **Manager References**: Update all contacts where `reportsToId === duplicateId` to `reportsToId = masterId` to avoid orphaned child relationships.
  - Remove the duplicate contact from the store using `dbStore.contacts.delete`.
  - Create a detailed `merge_contacts` audit log tracking the changes.
  - Trigger `contact.merged` webhook event.
  - Return the updated master contact representation with status `200 OK`.

## Row-Level Security & Tenant Isolation
* All operations MUST run under strict active tenant contexts.
* Any attempt by Tenant B to discover duplicates of Tenant A's contact or merge Tenant A's contacts MUST fail with `404 Not Found` or an explicit RLS error.
