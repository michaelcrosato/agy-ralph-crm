# Specification: Marketing Sequence Global Merge Variables - Requirements

## 1. Functional Requirements

### 1.1 Global Variables Management
- The system must allow authenticated users to define, view, and delete global merge variables.
- Each global variable must consist of:
  - `key`: A unique key (e.g. `companyName`, `supportEmail`) consisting of alphanumeric characters and underscores.
  - `value`: A string value that will replace the placeholder.
- Attempting to add a variable with a key that already exists under the same tenant should overwrite the existing variable's value or return an update.

### 1.2 Global Variables Placeholder Resolving
- The template compiler must parse and resolve placeholders prefixed with `global.`, e.g., `{{global.key}}`.
- The engine must support combining global placeholders with existing personalization filters:
  - Default fallbacks: `{{global.phone | default("N/A")}}`
  - Casing transformations: `{{global.company | uppercase}}`
- If a global key is not defined and has no default fallback, it must resolve to an empty string `""` safely without throwing an exception.

### 1.3 REST Settings API
- Endpoints must reside under `/api/sequences/settings/variables` (with tenant authentication).
- `GET /api/sequences/settings/variables`: Returns a JSON payload containing all global variables for the active organization.
- `POST /api/sequences/settings/variables`: Creates or updates a global variable. Accepts `key` and `value` in the JSON body.
- `DELETE /api/sequences/settings/variables/:id`: Deletes the global variable with the specified UUID.

## 2. Non-Functional & Security Requirements
- **Tenant Isolation**: Database-level and store-level tenancy checks must be strictly applied. A tenant must never be able to access, modify, or resolve another tenant's global variables.
- **Microsecond Execution Speed**: Parsing global variables must have negligible impact on sequence execution times.
- **Robustness**: Dynamic string replacement must handle special characters in global variable values cleanly.
