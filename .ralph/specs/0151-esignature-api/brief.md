# Specification: E-Signature Integration & Document Signing API - Brief

## 1. Functional Objective
To streamline sales and contract administration, a modern commercial CRM must manage document signing workflows (electronic signatures). 

This feature introduces the **E-Signature (Electronic Signature) Requests and Document Signing API**. The system will:
1. Allow tenants to create electronic signature requests for existing CRM Contracts or Sales Opportunities.
2. Track request details, including signer email, document name, status (`"sent"`, `"viewed"`, `"signed"`, `"declined"`), sending date, and completed date.
3. Provide a simulation engine in `packages/core` to simulate a signer opening a document, viewing it, signing it, or declining it, which automatically updates the request state and triggers corresponding timeline event logging.
4. Expose REST endpoints to manage requests, trigger simulated signature updates, and handle webhook-like callbacks under strict Row-Level Security (RLS) tenant isolation.
5. Record automatic CRM audit trails when a request changes status.

## 2. Technical Scope
- **Database Schema**:
  - Add `esignature_requests` table to `packages/db/src/schema.ts` and update the in-memory store in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `processESignatureTransition` in `packages/core/src/index.ts` to execute state changes, ensuring correct status flow transitions (e.g., `"sent"` -> `"viewed"` -> `"signed"`) and returning timeline logs.
- **REST Endpoints**:
  - `POST /api/sales/esignature/requests` - Creates a new E-Signature request linked to an Opportunity or Contract.
  - `GET /api/sales/esignature/requests` - Queries E-Signature requests for the tenant.
  - `POST /api/sales/esignature/simulate` - Triggers a simulated signer action (`"view"`, `"sign"`, `"decline"`), updating the request and writing timeline audit events.
- **Tenant RLS & Security**:
  - All E-Signature requests and simulated operations must run strictly within the active tenant's context. A tenant must never see or transition requests belonging to other organizations.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/esignature.test.ts` validating request creation, state machine validation rules, and tenant RLS isolation.
