# Specification: Public Web-to-Lead Capture API - Brief

## 1. Functional Objective
This feature introduces a public, unauthenticated Web-to-Lead Capture API to the modular CRM core. It enables external web forms to submit lead details (e.g. name, email, company, and custom metadata fields) directly to the CRM database under a specified tenant organization. 

The endpoint must operate without JWT session authentication, instead routing requests based on a provided `orgId`. Crucially, to prevent data leakages and ensure multi-tenant security, the request must be wrapped inside the active tenant RLS context dynamically before any database access occurs. Additionally, captured leads must automatically evaluate active Lead Assignment Rules for the tenant to assign ownership, log full audit trail records, and trigger outbound webhooks.

## 2. Technical Scope
- **Public REST Endpoint**: Expose an unauthenticated endpoint at `POST /api/public/web-to-lead`.
- **Active Tenancy Isolation**: Ensure that the incoming request dynamically activates the row-level security (RLS) context using `withTenant(orgId, mockDb, ...)` before performing any database insertions or queries.
- **Lead Assignment Engine Integration**: Evaluate active Lead Assignment Rules for the target tenant org. If rules match, assign ownership and update round-robin indices; if no rules match or exist, assign a default owner (the provided `ownerId` in payload or the first user in the organization).
- **Validation**: Validate that the target `orgId` exists in the system and that the payload contains required lead fields (`lastName`, `email`). Perform dynamic custom field validation using `validateCustomFields` against defined schemas for the tenant.
- **Downstream Triggers**: Log the creation event in the tenant's immutable `audit_logs` and trigger outbound webhooks (`lead.created`) asynchronously.
- **Verification**: Complete integration tests asserting correct RLS context propagation, lead routing evaluation, custom validation rules, audit logs, and webhook triggers.
