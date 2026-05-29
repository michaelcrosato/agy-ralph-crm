# Spec 0141: Sales Path Guidance API Requirements

## Functional Requirements

### 1. Stage Guidance Configuration Persistence
- The system must persist a configured "Sales Path Stage Guidance" rule for any standard CRM object type (specifically `opportunities` and `leads`) and its corresponding stage.
- Each rule must contain:
  - `objectType`: String (e.g. `"opportunities"`, `"leads"`).
  - `stage`: String (e.g. `"Qualification"`, `"Closed Won"`, `"Prospecting"`, `"New"`).
  - `keyFields`: Array of strings representing the API field names (e.g. `["amount", "closeDate", "custom.budget"]`).
  - `guidanceText`: Text/markdown detailing step-by-step guidance.
  - `isActive`: Boolean flag indicating if the rule is currently active.
- Modifying or adding stage guidance configurations must register an audit log entry.

### 2. Tenant Row-Level Security (RLS) Isolation
- All stage guidance configurations must be partitioned by `orgId`.
- Under no circumstances may a user from Organization A view, query, create, or update the stage guidance configurations belonging to Organization B.
- Any attempt to bypass this must throw a strict database row-level isolation violation.

### 3. Core Validation & Formatter Engine
- Implement a pure utility function `validateStageGuidanceKeyFields(record: Record<string, unknown>, keyFields: string[]): { isClean: boolean; missingFields: string[] }` inside `packages/core`.
- The function must inspect a CRM record (Lead, Account, Contact, or Opportunity) and verify that all defined `keyFields` are non-null, non-undefined, and contain a non-empty string or a valid numeric/boolean value.
- Support nested custom fields inside the `custom` JSONB block using the dot-prefixed syntax (e.g. `"custom.budget"` must check `record.custom.budget`).

### 4. REST API Endpoint Coverage
- **`GET /api/stage-guidance`**: Fetch all stage guidance rules for the active tenant.
- **`GET /api/stage-guidance/:objectType/:stage`**: Retrieve the active stage guidance and key fields rules for a specific object type and stage (if none active, return a 404 or a null representation gracefully).
- **`POST /api/stage-guidance`**: Insert a new or update an existing stage guidance rule. If an `id` is provided, update the existing entry; if not, insert a new entry.
- Endpoints must reside under the existing Hono `tenantAuth` middleware context.

## Non-Functional Requirements

### 1. Robust Type Safety
- All new database types and interfaces must be clearly defined in `packages/db/src/schema.ts` and `packages/db/src/index.ts`.
- Pure business logic must expose fully validated TypeScript interfaces in `packages/core/src/index.ts`.

### 2. Zero-Leak Architecture
- Core functions in `packages/core` must have zero knowledge of database persistence or REST routers.
- The monorepo dependency hierarchy must be strictly maintained (Core does not import DB or API).

### 3. High Performance
- Retrieve operations must compile with microsecond latency using standard in-memory array operations on the mock database store.
