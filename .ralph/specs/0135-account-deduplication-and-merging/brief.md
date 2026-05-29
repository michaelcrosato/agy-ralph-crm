# Spec 0135: Account De-duplication and Merging API Brief

## Objective
Enable automatic matching, duplicate identification, and secure multi-tenant merging for Accounts in the CRM Core. Duplicate accounts degrade CRM data quality, leading to fractured timelines, duplicate sales reach-out, and inaccurate opportunity reports. This feature provides a robust, RLS-isolated de-duplication engine that identifies potential duplicate accounts based on name and domain matching rules, and supports merging a duplicate account into a master account while resolving field-level conflicts, consolidating child contacts, opportunities, activities, contracts, and account team memberships.

## Scope
* **Core Business Logic**: Implement pure functions to identify potential duplicates from a list of accounts (`calculateAccountDuplicates`) and merge two account records based on a field resolution map (`mergeAccounts`).
* **Database & Store Actions**: Update `dbStore.accounts` to support `delete` operations, allowing physical removal of merged duplicate accounts under active tenant RLS isolation.
* **REST API Endpoints**:
  - `GET /api/accounts/:id/duplicates`: Query potential duplicate accounts in the active organization.
  - `POST /api/accounts/:id/merge`: Merge a specific duplicate account into the target (master) account, consolidating custom fields, re-parenting contacts, opportunities, activities, contracts, and team memberships, and deleting the duplicate account under transactional active tenant RLS isolation.
* **Audit Trail & Webhooks**: Log a detailed audit log entry tracking the merge and field resolutions, and trigger an `account.merged` outbound webhook event.
* **Row-Level Security**: Ensure complete tenant isolation—preventing users from identifying or merging accounts across different organizations.
