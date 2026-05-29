# Spec 0129: Sales Contracts & Account Renewals Engine Brief

## Objective
Introduce contract management and automated account renewals to the CRM Core. For commercial enterprise SaaS platforms, managing sales contracts (start/end dates, amounts, status) and automatically generating renewal opportunities before expiration is essential for tracking customer retention and predictable recurring revenue.

This feature enables sales operations to track active customer contracts, define renewal windows, apply price escalation rates for renewals, and automatically generate renewal opportunities linked back to the customer's account under strict multi-tenant Row-Level Security (RLS) isolation.

## Scope
* **Core Business Logic (`packages/core`)**:
  - Implement contract renewal price calculations (with escalation percentage).
  - Implement renewal window validation (identifying if a contract is eligible for renewal).
  - Define mapping logic for generating a renewal opportunity from an existing contract.
* **Database & Store Actions (`packages/db`)**:
  - Add the `contracts` schema definition to `packages/db/src/schema.ts`.
  - Equip `packages/db/src/index.ts` with a secure tenant-isolated `contracts` store supporting full CRUD.
* **REST API Endpoints (`apps/api`)**:
  - `GET /api/accounts/:id/contracts`: Retrieve all contracts associated with a specific account.
  - `POST /api/contracts`: Create a new contract.
  - `PATCH /api/contracts/:id`: Update contract status, dates, and amounts.
  - `DELETE /api/contracts/:id`: Remove a contract.
  - `POST /api/contracts/:id/renew`: Process a contract renewal, creating an associated renewal opportunity and updating the contract status to "Renewed".
* **Audit Trail & Webhooks**:
  - Log audit trail entries for contract creation, update, and renewal processes.
  - Dispatch outbound webhook events (`contract.created`, `contract.updated`, `contract.renewed`).
* **Row-Level Security**:
  - Verify that all database mutations and queries strictly adhere to the current organization context, preventing data leaks across tenant boundaries.
