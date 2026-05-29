# Specification: Marketing Segments & Dynamic Lists API - Requirements

## 1. Functional Requirements

### 1.1 Segment Definition & CRUD
- **REQ-1.1.1**: The system must support creating dynamic Segments, containing: `id` (UUID), `orgId` (UUID), `name` (text), `description` (text), `objectType` ("lead" | "contact"), and `criteria` (JSONB array of CriteriaCondition).
- **REQ-1.1.2**: Each condition in `criteria` must follow the `CriteriaCondition` structure:
  - `field`: string (e.g. `status`, `company`, or `custom.some_field`).
  - `operator`: "equals" | "not_equal" | "contains" | "greater_than" | "less_than".
  - `value`: string.
- **REQ-1.1.3**: RLS tenant isolation must govern all Segment administration operations.

### 1.2 Dynamic Member Resolution Engine
- **REQ-1.2.1**: The system must provide a resolver function `resolveSegmentMembers` that fetches segment details and dynamically queries and filters members.
- **REQ-1.2.2**: The resolver must support:
  - Filtering Leads (if `objectType === "lead"`) or Contacts (if `objectType === "contact"`).
  - Correct evaluation of conditions using standard operators:
    - `equals`: Case-insensitive strict match of string values.
    - `not_equal`: Case-insensitive inequality match.
    - `contains`: Case-insensitive search match.
    - `greater_than`: Numeric conversion comparison (greater than).
    - `less_than`: Numeric conversion comparison (less than).
  - Resolving custom fields stored in the record's `custom` JSONB property (e.g. field references like `custom.some_field` should look inside the record's custom fields).
- **REQ-1.2.3**: If the record has missing or undefined values for a specified condition field, the record must not match.

### 1.3 REST API Endpoints
- **REQ-1.3.1**: `POST /api/segments` - Create a dynamic segment.
- **REQ-1.3.2**: `GET /api/segments` - List all dynamic segments for the active tenant org.
- **REQ-1.3.3**: `GET /api/segments/:id` - Retrieve segment details.
- **REQ-1.3.4**: `DELETE /api/segments/:id` - Delete a segment by ID.
- **REQ-1.3.5**: `GET /api/segments/:id/members` - Retrieve the resolved dynamic list of member records under active tenant RLS isolation.

## 2. Technical & Security Requirements
- **REQ-2.1**: Complete tenant RLS isolation: a tenant must never be able to view, update, delete, or resolve members of another tenant's segments.
- **REQ-2.2**: TypeScript monorepo must compile cleanly without any compilation or type check errors.
- **REQ-2.3**: Biome linter checks must pass cleanly without warning or error reports.
