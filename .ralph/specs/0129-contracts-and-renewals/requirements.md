# Spec 0129: Sales Contracts & Account Renewals Requirements

## Functional Requirements

### 1. Contract Entity Tracking
* The system MUST store key metrics for customer contracts, including:
  - Account ID (linked customer)
  - Opportunity ID (originating sales opportunity)
  - Contract Amount (total contract value)
  - Start Date
  - End Date
  - Status (`Draft`, `Active`, `Expired`, `Renewed`)
* A new contract MUST default to `Draft` status.
* When a contract is renewed, its status MUST transition to `Renewed`.

### 2. Renewal Price Escalation & Core Logic
* The core logic MUST calculate renewal opportunity pricing applying an escalation percentage (e.g., 5% standard SaaS markup).
* The core logic MUST identify if a contract falls inside its renewal window based on the end date and a threshold number of days (e.g., within 90 days of expiration).
* The core logic MUST construct a renewal opportunity payload matching:
  - Close Date = Current contract's End Date
  - Stage = "Qualification"
  - Amount = Original contract value * (1 + escalation percentage)
  - Name = "Renewal - [Original Account Name] - [Contract End Date]"

### 3. REST API CRUD & Action Execution
* `GET /api/accounts/:id/contracts`:
  - MUST return a 404 error if the parent Account record is not found or belongs to another tenant.
  - MUST return a list of contracts associated with the given account under active tenant RLS isolation.
* `POST /api/contracts`:
  - MUST require `accountId`, `contractAmount`, `startDate`, and `endDate`.
  - MUST enforce that the associated account belongs to the caller's active tenant org.
* `PATCH /api/contracts/:id`:
  - MUST allow modifying dates, amount, and status.
  - MUST throw a 404 error if the contract is missing or belongs to a different tenant.
* `DELETE /api/contracts/:id`:
  - MUST successfully remove the contract record if it belongs to the active tenant.
* `POST /api/contracts/:id/renew`:
  - MUST throw a 404 error if the contract does not exist.
  - MUST validate that the contract status is `Active` before permitting renewal.
  - MUST accept an optional custom `escalationPercentage` query/body parameter (defaulting to 5% if omitted).
  - MUST transition the contract status to `Renewed`.
  - MUST insert a new Opportunity with the calculated renewal details and link it to the contract's account.
  - MUST return the generated Opportunity.

### 4. Tenancy & Row-Level Security (RLS)
* Every contract mutation or retrieval MUST be scoped to the caller's active `orgId`.
* Direct access, modification, deletion, or renewal of a contract belonging to another tenant MUST throw an RLS isolation violation.

### 5. Audit Logging & Webhooks
* Generating, updating, or renewing a contract MUST write an audit ledger entry tracking changes.
* System events MUST trigger outbound webhooks for:
  - `contract.created`
  - `contract.updated`
  - `contract.renewed`
