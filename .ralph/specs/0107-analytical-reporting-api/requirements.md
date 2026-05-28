# Specification: Analytical Reporting & Saved Views REST API - Requirements

## Functional Requirements
1. **Database Schema & Store Extensions:**
   - Extend the relational PostgreSQL schema and mock store in `packages/db` with a `reports` structure.
   - Reports must support configuration fields: `name`, `objectType` ("leads" | "opportunities" | "tickets" | "accounts" | "contacts"), `groupBy` (field API name, which can be standard or custom JSONB field), `aggregateField` (field to aggregate, optional), and `aggregateFunc` ("count" | "sum" | "avg").
2. **Analytical Reporting Engine (`packages/reporting`):**
   - Implement `runReport` in `packages/reporting` to process a report definition and execute grouping and aggregates dynamically.
   - The engine must extract grouping values dynamically from either the record's root properties or from the `custom` JSONB properties.
   - The engine must correctly compute aggregation functions:
     - `count`: count the number of records in each group.
     - `sum`: sum the numeric representation of the specified field for each record in the group.
     - `avg`: compute the average value of the specified field for records in the group.
3. **REST API Endpoints (`apps/api`):**
   - `POST /api/reports` - Creates and saves a new report definition under the tenant context.
   - `GET /api/reports` - Lists all saved report definitions under the active tenant context.
   - `POST /api/reports/run` - Runs an ad-hoc report definition passed in the request body (without saving it).
   - `GET /api/reports/:id/run` - Runs a saved report definition by its ID.

## Security & Isolation Requirements
1. **RLS Tenant Isolation:**
   - All report management operations (creation, listing, running) must enforce active tenant filtering. Users can never access report definitions or query data from other organizations.
   - Report execution must automatically respect database-level RLS, pulling only records owned by the active tenant organization.
2. **Verification Requirements:**
   - Add integration tests verifying correct CRUD behavior, grouping computation (both standard and custom JSONB fields), aggregation calculations, and RLS tenant isolation.
