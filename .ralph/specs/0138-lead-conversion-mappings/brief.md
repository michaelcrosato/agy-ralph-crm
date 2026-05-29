# Spec 0138: Lead Conversion Field Mapping Engine Brief

## Objective
Enable sales operations and administrators to define dynamic custom field mappings that govern how data is transferred from a Lead record to the resulting Account, Contact, and Opportunity records during Lead Conversion. Currently, Lead Conversion only performs hardcoded mapping of standard fields and passes all custom fields as-is to the Account custom field. As companies scale, they require granular control over where their proprietary lead intelligence (such as marketing source, industry segment, or budget range) lands when transitioning from a lead to sales stages. This engine provides a robust, multi-tenant Row-Level Security (RLS) isolated API to configure, query, and enforce lead-to-target mapping logic.

## Scope
* **Core Business Logic**: Implement custom field mapping resolution in `packages/core` via `convertLeadWithMappings`, mapping source lead fields (both standard and custom JSONB fields) to target object fields (Accounts, Contacts, and Opportunities).
* **Database & Store Actions**: Update `packages/db` with a new `lead_conversion_mappings` schema, store array, and dbStore operations (`findMany`, `findOne`, `insert`, `delete`) with strict organization-level RLS context checks.
* **REST API Endpoints**:
  - `GET /api/lead-conversions/mappings`: Retrieve all active field mappings for the active organization.
  - `POST /api/lead-conversions/mappings`: Create a mapping record specifying sourceLeadField, targetObjectType, and targetField.
  - `DELETE /api/lead-conversions/mappings/:id`: Delete a mapping record.
  - **Updated** `POST /api/leads/:id/convert`: Update the lead conversion route to fetch active mappings, perform mapping, and insert the target entities with the mapped fields.
* **Audit Trail & Webhooks**: Log detailed audit logs when mappings are created or removed, and trigger a `lead.converted` webhook reflecting the fully mapped attributes.
* **Row-Level Security**: Ensure strict tenant isolation, preventing Tenant B from viewing, modifying, or applying Tenant A's conversion mappings.
