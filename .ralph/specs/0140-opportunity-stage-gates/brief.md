# Spec 0140: Opportunity Stage Gates & Validation Rules Brief

## Objective
Introduce automated Opportunity Stage Gates (validation rules) into the CRM core. Often, sales organizations require that opportunities meet specific criteria before moving to a advanced stage (e.g. they cannot move to "Closed Won" unless `amount` is set and greater than 0, or `closeDate` is specified). This specification introduces configurable stage gates on opportunities, letting tenants define validation criteria for any stage. If an opportunity stage transitions and does not meet the specified criteria, the CRM will abort the transition and return clear, actionable validation error messages. All operations must operate under strict, active tenant Row-Level Security (RLS) isolation.

## Scope
* **Database & Persistence**: Update `packages/db` with a new `opportunity_stage_gates` schema and update `packages/db/src/index.ts` to support saving, updating, and querying stage gates under strict RLS isolation.
* **Core Logic**: Implement a pure validation utility `validateOpportunityStageGate` inside `packages/core` that takes an opportunity record (current + updates) and a list of configured gates, asserting whether the transition is valid and returning detailed validation error messages.
* **REST API Endpoints**:
  - `GET /api/stage-gates`: Fetch all defined stage gates for the authenticated tenant.
  - `POST /api/stage-gates`: Create or update a stage gate rule (target stage, field, operator, expected value, error message, isActive).
  - **Updated** `PATCH /api/opportunities/:id`: When the opportunity stage changes, retrieve active stage gates, run validation, and block the transition with an HTTP 400 response and errors list if validation fails.
* **Row-Level Security**: Ensure one tenant's stage gates cannot view, modify, or affect another tenant's opportunities or stage transitions.
