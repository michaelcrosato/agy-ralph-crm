# Specification: Opportunity Product Schedules API - Brief

## 1. Functional Objective
This feature introduces Opportunity Product Schedules (Revenue and Quantity Schedules) to the modular CRM core database, domain logic, and API routing layer. The system will support establishing periodic payment or delivery schedules for opportunity line items (e.g. recognizing revenue monthly or quarterly over a contract term), allowing collaborative revenue forecasting and precise shipment planning under strict row-level security.

## 2. Technical Scope
- **Tenancy Isolation**: The opportunity product schedules store must integrate fully with the tenant context and `AsyncLocalStorage` RLS context.
- **Pure Core Logic**: Core validation of schedules and automatic straight-line schedule generation will reside in `@crm/core`.
- **REST Endpoints**:
  - `GET /api/opportunities/:id/products/:productId/schedules` - Retrieve schedules.
  - `POST /api/opportunities/:id/products/:productId/schedules` - Create or update schedules.
  - `DELETE /api/opportunities/:id/products/:productId/schedules/:scheduleId` - Delete a specific schedule.
  - `POST /api/opportunities/:id/products/:productId/schedules/generate` - Automatically generate N monthly straight-line schedules.
- **Verification**: Complete unit and integration test coverage verifying multi-tenant isolation, schedule validation, straight-line generation, audit trail entries, and API routing.
