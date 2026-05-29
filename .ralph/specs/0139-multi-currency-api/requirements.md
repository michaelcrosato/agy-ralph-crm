# Spec 0139: Multi-Currency & Exchange Rates Engine Requirements

## Functional Requirements

### 1. Database Schema & Persistence (`currencies`)
* Define the database table `currencies` with fields:
  - `id`: Unique identifier (UUID, primary key, auto-generated).
  - `orgId`: Tenant organization reference (UUID, references `organizations.id`, cascade delete, not null).
  - `isoCode`: The 3-letter currency code (e.g. `USD`, `EUR`, `GBP`) (Text, not null). Must be unique per organization.
  - `displayName`: Descriptive name of the currency (e.g. `US Dollar`, `Euro`) (Text, not null).
  - `symbol`: Symbol of the currency (e.g. `$`, `€`, `£`) (Text, not null).
  - `exchangeRate`: The exchange rate of this currency relative to the corporate currency (Numeric/Decimal represented as a string, not null). For the corporate currency, this must be `1.0`.
  - `isCorporate`: Flag indicating if this is the tenant's primary corporate rollup currency (Boolean, default `false`, not null). Only one currency per org can be corporate.
  - `isActive`: Flag indicating if this currency is active for use (Boolean, default `true`, not null).
  - `createdAt`: Timestamp (default `now()`, not null).
  - `updatedAt`: Timestamp (default `now()`, not null).

### 2. Opportunity Schema Extensions
* Extend the existing `opportunities` schema or DB model structure to support:
  - `currencyCode`: The ISO code of the local currency for the opportunity (Text, default `USD`, not null).
  - `amountCorporate`: Stored converted amount of the opportunity in the corporate/base currency (Numeric/Decimal represented as string, nullable).

### 3. Core Calculations (`packages/core/src/index.ts`)
* Implement pure utility functions:
  - `convertCurrency(amount: string, fromRate: string, toRate: string): string`: Converts an amount from one currency to another using their exchange rates relative to the base currency.
  - `rollupOpportunityAmountsInBase(opportunities: { amount: string; exchangeRate: string }[]): string`: Rolls up a list of opportunity amounts that are already converted or specifies their active exchange rate to calculate the corporate consolidated sum.

### 4. REST API Endpoints in `apps/api/src/index.ts`
* Secure all endpoints with the `tenantAuth` middleware to enforce active tenant contexts.
* **GET `/api/currencies`**:
  - Retrieve all currencies defined for the active organization.
* **POST `/api/currencies`**:
  - Create or update a currency definition.
  - Body params: `isoCode` (3 chars, required), `displayName` (required), `symbol` (required), `exchangeRate` (numeric string, required), `isCorporate` (boolean, optional).
  - Ensure that if `isCorporate` is `true`, any existing corporate currency for that organization is updated to `isCorporate = false`.
  - Write a `create_currency` or `update_currency` audit log.
* **POST `/api/opportunities` and `PATCH /api/opportunities/:id`**:
  - Support setting `currencyCode` on the opportunity.
  - Automatically lookup the currency definition for the organization using `currencyCode`.
  - Calculate `amountCorporate = amount * (1 / exchangeRate)`.
  - Save the calculated `amountCorporate` along with `currencyCode`.

### 5. Row-Level Security & Tenant Isolation
* Queries and mutations MUST strictly operate within the active tenant organization context.
* A user from Tenant A MUST NEVER be able to query, create, delete, or trigger conversions using currencies belonging to Tenant B.
