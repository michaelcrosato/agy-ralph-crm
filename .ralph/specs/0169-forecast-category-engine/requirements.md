# Task 0169: Opportunity Forecast Category Mapping & Category-Based Forecasting Engine - Requirements

## Functional Requirements
1. **Stage to Category Mapping Storage**:
   - Provide a persistent table/store `stageForecastMappings` mapping a unique stage to a forecast category.
   - Supported forecast categories MUST be exactly: `"Omitted" | "Pipeline" | "Best Case" | "Commit" | "Closed"`.
   - Every mapping belongs to a specific tenant organization (`orgId`) and is isolated under active RLS checks.

2. **Stage Mapping REST API**:
   - `POST /api/forecasting/stage-mappings`: Create or update a stage-to-forecast-category mapping for the active tenant.
   - `GET /api/forecasting/stage-mappings`: Retrieve all stage-to-category mappings for the active tenant.

3. **Forecast Category Aggregation REST API**:
   - `GET /api/forecasting/categories-summary`: Retrieve aggregated pipeline metrics grouped by forecast categories for a given `period` (format `YYYY-MM`), incorporating active tenant RLS isolation.
   - Aggregated metrics per forecast category MUST include:
     - `actualAmount`: Sum of opportunity amounts in the category.
     - `weightedAmount`: Sum of opportunity amounts in the category multiplied by their stage win probability.
     - `count`: Number of opportunities in that category.
   - If no custom stage mapping exists for a stage, it MUST fall back to a default stage mapping:
     - `Prospecting` | `Qualification` | `Needs Analysis` -> `Pipeline`
     - `Proposal` -> `Best Case`
     - `Negotiation` -> `Commit`
     - `Closed Won` -> `Closed`
     - `Closed Lost` -> `Omitted`
     - Any other stage -> `Pipeline`

## Non-Functional Requirements
1. **Multi-Tenant RLS Security Isolation**:
   - The REST endpoints must be protected by the `tenantAuth` middleware.
   - Mappings and aggregated results must be scoped strictly to the authenticated tenant (`orgId`).
   - Mappings from one tenant must never be visible to or modifiable by another tenant.

2. **Zero Placeholders**:
   - The implementation must contain complete, production-ready code with no placeholder or TODO comments.

3. **Performance and Verification**:
   - The new features must compile cleanly with `pnpm typecheck` and pass lint rules with `pnpm lint`.
   - Complete integration tests must pass cleanly under the verification suite.
