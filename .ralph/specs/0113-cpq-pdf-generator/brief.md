# Specification: CPQ PDF Generator - Brief

## 1. Functional Objective
This feature introduces a Configure-Price-Quote (CPQ) module that allows sales teams to compile complex product configurations, apply tier-based volume discounts and custom manual discounts, and generate beautiful, standardized HTML quotes. These quotes are compiled using the `@crm/documents` engine and can be saved in the database as audit-compliant merged documents.

## 2. Technical Scope
- **Tenancy Isolation**: The CPQ operations and document persistence must integrate with the tenant context and the AsyncLocalStorage row-level security (RLS) context.
- **Pure Core Logic**: Core tier-based pricing calculations and discount policies will reside in `@crm/core` as pure relational functions.
- **REST Endpoints**:
  - `POST /api/opportunities/:id/quote` - Generate and persist a standardized quote document for an Opportunity, applying volume discounts.
  - `GET /api/opportunities/:id/quote` - Retrieve the compiled quote document and discount calculation details.
- **Verification**: Complete unit and integration test coverage verifying tier-based calculations, HTML template compilation, and absolute RLS separation between tenants.
