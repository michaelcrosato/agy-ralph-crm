# Specification: Accounts & Contacts REST API - Requirements

## Functional Requirements
1. **REST API Endpoints:**
   - `GET /api/accounts` - Lists all accounts for the active tenant, isolated by database-level RLS.
   - `GET /api/accounts/:id` - Retrieves details of a specific account, returning 404 if not found or belongs to another tenant.
   - `GET /api/contacts` - Lists all contacts for the active tenant.
   - `GET /api/contacts/:id` - Retrieves details of a specific contact.

## Security & Verification Requirements
1. **Multi-Tenant Isolation:**
   - A tenant MUST NOT be able to view, query, or enumerate accounts/contacts belonging to another organization.
2. **Integration Verification:**
   - Add integration tests verifying correct CRUD operations, status returns, and isolation barriers.
3. **Linter & Typechecks:**
   - The entire codebase must compile and lint perfectly.
