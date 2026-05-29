# Spec 0136: Contact De-duplication and Merging API Brief

## Objective
Enable automatic matching, duplicate identification, and secure multi-tenant merging for Contacts in the CRM Core. Duplicate contacts degrade CRM data quality, leading to fractured timelines, duplicate sales reach-out, and inaccurate reporting. This feature provides a robust, RLS-isolated de-duplication engine that identifies potential duplicate contacts based on email and name matching rules, and supports merging a duplicate contact into a master contact while resolving field-level conflicts, consolidating child tickets, campaign memberships, opportunity contact roles, activity links, and updating parent/manager references.

## Scope
* **Core Business Logic**: Implement pure functions to identify potential duplicates from a list of contacts (`calculateContactDuplicates`) and merge two contact records based on a field resolution map (`mergeContacts`).
* **Database & Store Actions**: Update `dbStore.contacts` to support `delete` operations, allowing physical removal of merged duplicate contacts under active tenant RLS isolation.
* **REST API Endpoints**:
  - `GET /api/contacts/:id/duplicates`: Query potential duplicate contacts in the active organization.
  - `POST /api/contacts/:id/merge`: Merge a specific duplicate contact into the target (master) contact, consolidating custom fields, re-parenting tickets, campaign memberships, opportunity contact roles, activity links, and parent manager references, and deleting the duplicate contact under transactional active tenant RLS isolation.
* **Audit Trail & Webhooks**: Log a detailed audit log entry tracking the merge and field resolutions, and trigger a `contact.merged` outbound webhook event.
* **Row-Level Security**: Ensure complete tenant isolation—preventing users from identifying or merging contacts across different organizations.
