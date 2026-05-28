# Specification: Lead Operations API & Multi-Tenant RLS Store - Requirements

## Functional Requirements
1. **API Endpoints:**
   - `POST /api/leads` - Creates a new lead with status, email, company, and custom JSONB fields. Automatically links the lead to the calling user (owner) and active organization (tenant).
   - `GET /api/leads` - Lists all leads owned by or accessible to the active organization (tenant), under strict RLS isolation.
   - `GET /api/leads/:id` - Retrieves a specific lead, verifying tenant ownership.
   - `POST /api/leads/:id/convert` - Atomic operation to convert a Lead to Account, Contact, and optionally Opportunity. Updates Lead status to "Converted", creates Account, Contact, and Opportunity records, logs audit trails, and returns the converted entities' details.
2. **Multi-Tenant RLS Store:**
   - Multi-tenant isolation at the database level.
   - Using `AsyncLocalStorage` to store the active tenant context (`orgId`), preventing any cross-tenant data leaks.
   - Any query or mutate command must assert that the target record matches the active tenant `orgId`.
3. **Auditing Ledger:**
   - Any insertion or update to Lead, Account, Contact, or Opportunity records must write a chronological, immutable entry into the `auditLogs` table.

## Verification Requirements
1. **Unit & Integration Tests:**
   - Verify that non-authenticated API requests are rejected (401).
   - Verify that requests to access records belonging to another tenant are rejected (403 or 404).
   - Verify that lead conversion correctly instantiates child entities, populates fields, updates lead status, and logs audit records.
2. **TypeScript & Biome Linters:**
   - All workspace packages and applications must compile and lint perfectly.
