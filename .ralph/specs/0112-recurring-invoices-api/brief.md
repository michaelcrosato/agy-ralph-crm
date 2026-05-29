# Specification: Recurring Invoicing & Subscription Billing API - Brief

## 1. Functional Objective
This feature introduces automated subscription plans and billing management to the modular CRM core database and API routing layer. The system will support registering customer subscriptions (e.g. Monthly/Annual plans), tracking start and end dates, and dynamically generating invoice records containing accurate, itemized line items.

## 2. Technical Scope
- **Tenancy Isolation**: The subscription and invoice stores must integrate fully with the tenant context andAsyncLocalStorage RLS context.
- **Pure Core Logic**: Core pro-rated pricing calculations will reside in `@crm/core` as pure relational functions.
- **REST Endpoints**:
  - `POST /api/subscriptions` - Create subscription record.
  - `GET /api/subscriptions` - List subscription records.
  - `POST /api/invoices/generate` - Generate outstanding invoices.
  - `GET /api/invoices` - Retrieve billing history invoices.
- **Verification**: Complete unit and integration test coverage verifying multi-tenant isolation, pro-ration arithmetic, and API contract validations.
