# Specification: Sales Commission Calculation & Attainment Tracking - Requirements

## 1. Functional Requirements

### 1.1 Commission Calculation Rules
- **REQ-1.1.1**: The commission engine must only calculate commissions for opportunities in the "Closed Won" stage. Any opportunity in other stages must result in a commission of zero.
- **REQ-1.1.2**: Standard commission calculation should be: `Opportunity Amount * Base Commission Rate`.
- **REQ-1.1.3**: The engine must support quota attainment-based performance accelerators:
  - If the user's Closed Won opportunity total in the period is below 100% of their target quota, the standard `Base Commission Rate` (default 5% / `0.05`) is applied.
  - If the user's quota attainment is between 100% (inclusive) and 150% (exclusive), the rate is boosted by a multiplier of `1.2x` (effective rate: 6% / `0.06`).
  - If the user's quota attainment is 150% or above (inclusive), the rate is boosted by a multiplier of `1.5x` (effective rate: 7.5% / `0.075`).
- **REQ-1.1.4**: Define a pure utility function `calculateOpportunityCommission` in `packages/core` that returns the calculated commission amount, the quota attainment calculated, the rate applied, and any bonus multiplier.

### 1.2 Multi-Tenant Commissions Schema
- **REQ-1.2.1**: Define the database schema for `commissions` in `packages/db`.
- **REQ-1.2.2**: The `commissions` table must track:
  - `id`: unique UUID
  - `orgId`: tenant organization UUID reference
  - `userId`: user UUID reference (sales rep earning commission)
  - `opportunityId`: opportunity UUID reference
  - `amount`: text string for precise decimal representation
  - `rateApplied`: text string representing the commission rate (e.g. "0.05")
  - `status`: "Pending" | "Approved" | "Paid" (default: "Pending")
  - `createdAt`: timestamp

### 1.3 Commission Calculation REST API
- **REQ-1.3.1**: Expose `POST /api/commissions/calculate` protected by `tenantAuth`.
- **REQ-1.3.2**: Accept body `opportunityId` and optional `baseRate`.
- **REQ-1.3.3**: Validate that the opportunity exists and belongs to the active tenant. Return `404` if not found.
- **REQ-1.3.4**: Ensure that a commission record does not already exist for the opportunity. Return `400` if already calculated.
- **REQ-1.3.5**: Retrieve the opportunity's closeDate period (formatted as "YYYY-MM") and fetch the owner's quota for that period.
- **REQ-1.3.6**: Aggregate all other Closed Won opportunities for the same owner in the same period to compute active quota attainment.
- **REQ-1.3.7**: Calculate the commission amount and insert a new record in `commissions` with status "Pending".
- **REQ-1.3.8**: Log an audit trail entry (`DBAuditLog`) of `action: "calculate"` and `recordType: "Commission"`.

### 1.4 Commission Approval REST API
- **REQ-1.4.1**: Expose `POST /api/commissions/:id/approve` protected by `tenantAuth`.
- **REQ-1.4.2**: Verify that the commission record exists, belongs to the active tenant, and is in "Pending" status.
- **REQ-1.4.3**: Update status to "Approved".
- **REQ-1.4.4**: Log an audit trail entry (`DBAuditLog`) of `action: "approve"` and `recordType: "Commission"`.

### 1.5 Commission Listing REST API
- **REQ-1.5.1**: Expose `GET /api/commissions` protected by `tenantAuth` returning all commission records.

## 2. Technical & Security Requirements
- **REQ-2.1**: Active Row-Level Security (RLS) context must prevent cross-tenant data leakage. Any calculation, viewing, or approval attempt from Tenant B to Tenant A's records must fail with a `404` or throw a database error.
- **REQ-2.2**: All types and lint checks must compile and verify cleanly across the workspace via `pnpm verify`.
