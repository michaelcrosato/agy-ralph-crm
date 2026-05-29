# Spec 0140: Opportunity Stage Gates & Validation Rules Requirements

## Functional Requirements

### 1. Database Persistence (`opportunity_stage_gates`)
* Define database table `opportunity_stage_gates` containing:
  - `id`: Unique identifier (UUID, primary key, auto-generated).
  - `orgId`: Tenant organization reference (UUID, references `organizations.id`, cascade delete, not null).
  - `targetStage`: The stage name which requires validation (e.g. `Closed Won`, `Negotiation`) (Text, not null).
  - `field`: The opportunity field to assert (e.g. `amount`, `closeDate`, or custom JSON fields) (Text, not null).
  - `operator`: The validation operator (e.g. `equals`, `not_equals`, `greater_than`, `less_than`, `contains`, `is_not_empty`) (Text, not null).
  - `expectedValue`: The value to compare against (Text, nullable).
  - `errorMessage`: Custom validation error message to return when validation fails (Text, not null).
  - `isActive`: Flag indicating if the gate rule is active (Boolean, default `true`, not null).
  - `createdAt`: Timestamp (default `now()`, not null).
  - `updatedAt`: Timestamp (default `now()`, not null).

### 2. Pure Core Validation Logic (`packages/core/src/index.ts`)
* Implement pure utility function:
  - `validateOpportunityStageGate(opportunity: Record<string, unknown>, rules: StageGateRule[], newStage: string): { isValid: boolean; errorMessages: string[] }`
  - This function parses active rules targeting `newStage`.
  - Field values are extracted from the opportunity.
  - Assertions supported:
    - `equals`: Passes if `fieldValue === expectedValue`.
    - `not_equals`: Passes if `fieldValue !== expectedValue`.
    - `greater_than`: Parses numeric strings and asserts `fieldValue > expectedValue`. Fallback to string comparison.
    - `less_than`: Parses numeric strings and asserts `fieldValue < expectedValue`. Fallback to string comparison.
    - `contains`: Asserts `fieldValue.includes(expectedValue)`.
    - `is_not_empty`: Asserts `fieldValue` is not undefined, null, or empty string.

### 3. REST API Endpoints in `apps/api/src/index.ts`
* Secure all new endpoints using `tenantAuth` middleware to enforce active tenant contexts.
* **GET `/api/stage-gates`**:
  - Retrieve all defined stage gates for the active organization.
* **POST `/api/stage-gates`**:
  - Create or update a stage gate rule.
  - Body params: `targetStage` (required), `field` (required), `operator` (required), `expectedValue` (optional), `errorMessage` (required), `isActive` (optional).
  - Create a detailed audit log entry: `create_stage_gate` or `update_stage_gate`.
* **PATCH `/api/opportunities/:id`**:
  - Check if the stage is changing.
  - If the stage is changing, fetch all active stage gates for the organization.
  - Retrieve the existing opportunity record from the store, and merge it with the incoming patch updates.
  - Run the `validateOpportunityStageGate` core utility.
  - If validation fails, abort the save and return an HTTP `400 Bad Request` payload with the validation error messages.

### 4. Row-Level Security & Tenant Isolation
* Queries and mutations MUST strictly operate within the active tenant organization context.
* A user from Tenant A must never be able to query, create, or update Tenant B's stage gates, nor bypass validation based on Tenant B's criteria.
