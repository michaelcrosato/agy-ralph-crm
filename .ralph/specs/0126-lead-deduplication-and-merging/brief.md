# Spec 0126: Lead De-duplication and Merging API Brief

## Objective
Enable automatic matching, duplicate identification, and secure multi-tenant merging for Leads in the CRM Core. Duplicate data is one of the biggest challenges in customer relationship management. This feature provides a robust, RLS-isolated de-duplication engine that identifies potential duplicate leads based on email and company matching rules, and supports merging a duplicate lead into a master lead while resolving field-level conflicts (including custom metadata fields), consolidating campaign memberships, and migrating associated activity logs.

## Scope
* **Core Business Logic**: Implement pure functions to identify potential duplicates from a list of leads (`calculateLeadDuplicates`) and merge two lead records based on a field resolution map (`mergeLeads`).
* **Database & Store Actions**: Update `dbStore.leads` to support `delete` operations, allowing physical removal of merged duplicate leads under active tenant RLS isolation.
* **REST API Endpoints**:
  - `GET /api/leads/:id/duplicates`: Query potential duplicate leads in the active organization.
  - `POST /api/leads/:id/merge`: Merge a specific duplicate lead into the target (master) lead, consolidating custom fields, updating activities and campaign memberships, and logging the action.
* **Audit Trail & Webhooks**: Log a detailed audit log entry tracking the merge and field resolutions, and trigger a `lead.merged` outbound webhook.
* **Row-Level Security**: Ensure complete tenant isolation—preventing users from identifying or merging leads across different organizations.
