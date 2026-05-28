# Specification: Metadata API & Dynamic Field Customization - Requirements

## Functional Requirements
1. **Metadata API Endpoints:**
   - `POST /api/metadata/fields` - Registers a custom field definition for an object type (e.g., "leads", "accounts") with an API name, datatype ("text", "number", "boolean", "picklist"), and optional validation rules.
   - `GET /api/metadata/fields` - Lists all custom field definitions registered for the active tenant.
   - `POST /api/metadata/layouts/:objectType` - Creates or updates a form layout structure consisting of sections and ordering of fields.
   - `GET /api/metadata/layouts/:objectType` - Retrieves the compiled form layout for the active tenant, automatically pushing unassigned custom fields to an "Additional Custom Fields" fallback section.
2. **Schema Validation on Lead Mutation:**
   - Any `POST /api/leads` payload containing `custom` JSONB properties must validate these properties against the active tenant's registered "leads" field definitions using `@crm/metadata`.
   - If validation fails, return a 400 Bad Request detailing the exact schema mismatch errors.

## Verification Requirements
1. **Dynamic Custom Validation Tests:**
   - Verify that adding a custom lead field (e.g., `custom_priority` picklist) blocks lead creation when an invalid option is passed.
   - Verify that valid custom fields pass successfully.
   - Verify that retrieving the layout compiles configured fields and appends unassigned custom fields correctly.
2. **Linter & Typechecks:**
   - All tests, lint rules, and TypeScript compilation gates must return exit code 0.
