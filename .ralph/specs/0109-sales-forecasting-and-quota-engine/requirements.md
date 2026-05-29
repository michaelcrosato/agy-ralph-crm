# Specification: Sales Forecasting & Quota Engine - Requirements

## 1. Functional Requirements

### 1.1 Quota / Targets Management
- **REQ-1.1.1**: The system must support creating, listing, and retrieving Quota/Target records for users.
- **REQ-1.1.2**: A Quota record must contain: `id` (UUID), `orgId` (UUID), `userId` (UUID), `period` (text, e.g., `2026-Q2`, `2026-05`), and `targetAmount` (numeric string representation).
- **REQ-1.1.3**: RLS tenant isolation must apply to all Quota operations.

### 1.2 Stage Win Probabilities Configuration
- **REQ-1.2.1**: The system must allow tenants to customize the win probability percentage (0 to 100) associated with each sales opportunity stage.
- **REQ-1.2.2**: The system must fall back to standard probability defaults if no custom mapping is configured:
  - `"Prospecting"` -> 10%
  - `"Qualification"` -> 20%
  - `"Needs Analysis"` -> 30%
  - `"Proposal"` -> 60%
  - `"Negotiation"` -> 80%
  - `"Closed Won"` -> 100%
  - `"Closed Lost"` -> 0%
- **REQ-1.2.3**: Custom probabilities must contain: `id` (UUID), `orgId` (UUID), `stage` (text), and `probability` (integer, 0-100).

### 1.3 Weighted Pipeline & Forecast Aggregations
- **REQ-1.3.1**: The forecasting engine must calculate the weighted amount of an opportunity as: `opportunity.amount * opportunity.stage_probability`.
- **REQ-1.3.2**: The engine must support grouping and aggregating opportunities by close date period (month or quarter) and forecast category.
- **REQ-1.3.3**: The engine must compute Quota Attainment Percentage as: `(Sum of Closed Won Opportunity Amounts / Target Quota Amount) * 100`.

### 1.4 REST API Endpoints
- **REQ-1.4.1**: `POST /api/quotas` - Set/insert a new user target quota.
- **REQ-1.4.2**: `GET /api/quotas` - Retrieve active quotas for the current tenant.
- **REQ-1.4.3**: `POST /api/forecasting/probabilities` - Upsert custom stage probabilities.
- **REQ-1.4.4**: `GET /api/forecasting/probabilities` - Get active stage probabilities.
- **REQ-1.4.5**: `GET /api/forecasting/summary` - Generate weighted pipeline metrics, aggregates by period, and quota attainment percentages.

## 2. Non-Functional & Security Requirements
- **REQ-2.1**: Database-level RLS Isolation: tenants must never access quotas, custom probabilities, or forecast records from other organizations.
- **REQ-2.2**: Type-safety: strict TS definitions for all API routes and data structures.
- **REQ-2.3**: Full test coverage: unit tests in Vitest validating aggregation mathematics and integration API endpoints.
