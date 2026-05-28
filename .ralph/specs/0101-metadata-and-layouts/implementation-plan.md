# Specification: Metadata API & Dynamic Field Customization - Implementation Plan

## Code Generation Sequence

### Step 1: Database Metadata Store
Add `fieldDefinitions` and `layoutDefinitions` tables interfaces and find/insert RLS operations to `dbStore` inside `packages/db/src/index.ts`.

### Step 2: REST Metadata Endpoints
Implement metadata routes inside `apps/api/src/index.ts`:
- `POST /api/metadata/fields` (register custom field definition)
- `GET /api/metadata/fields` (list dynamic field definitions)
- `POST /api/metadata/layouts/:objectType` (save layout definition)
- `GET /api/metadata/layouts/:objectType` (retrieve compiled layout with custom fields)

### Step 3: Validate Leads Custom Fields
Integrate `validateCustomFields` into `POST /api/leads` handler to enforce schema check on any dynamic custom attributes submitted by the tenant.

### Step 4: Verification Testing
Create `packages/testing/src/metadata-api.test.ts` to assert that dynamic schemas block invalid inputs, allow valid inputs, and compile multi-section form layouts cleanly.
