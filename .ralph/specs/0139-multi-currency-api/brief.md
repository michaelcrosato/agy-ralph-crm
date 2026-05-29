# Spec 0139: Multi-Currency & Exchange Rates Engine Brief

## Objective
Enable international commercial operations inside the CRM by supporting Multi-Currency records and Tenant-Configurable Exchange Rates. Currently, all opportunities, products, and forecasts assume a single implicit corporate currency. As organizations expand globally, they require the ability to record opportunities and product prices in local currencies (e.g. EUR, GBP, JPY) while automatically rolling up pipeline value and quotas to a single corporate currency using active exchange rates. This specification details a Row-Level Security (RLS) isolated Multi-Currency engine and API to manage active currencies, configure exchange rates, and handle multi-currency conversions and rollups.

## Scope
* **Core Business Logic**: Implement a pure currency converter utility in `packages/core` that translates values between currencies using exchange rates, and a rollup utility to consolidate multi-currency opportunity amount payloads into the tenant's corporate currency.
* **Database & Store Actions**: Update `packages/db` with a new `currencies` schema, update the standard opportunity schema to support opportunity-specific currency and stored base currency conversion amounts, and implement dbStore operations for managing currencies with strict organization-level RLS context checks.
* **REST API Endpoints**:
  - `GET /api/currencies`: Retrieve active currencies and their exchange rates for the active organization.
  - `POST /api/currencies`: Define or update a currency (ISO code, name, exchangeRate, isCorporate status).
  - `GET /api/currencies/convert`: Retrieve a live conversion calculation.
  - **Updated** `POST /api/opportunities` and `PATCH /api/opportunities/:id`: Allow setting local currency for the opportunity, and automatically calculate and save the opportunity's base corporate currency amount.
* **Audit Trail & Webhooks**: Log detailed audit logs when currency records or exchange rates are created/updated, and trigger a `currency.updated` webhook when exchange rates change.
* **Row-Level Security**: Ensure strict tenant isolation, preventing Tenant B from viewing, modifying, or querying Tenant A's currency rates.
