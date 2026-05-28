# Phase 3: Metadata Customization Engine & Analytical Reporting - Requirements

## Functional Requirements
1. **Dynamic Field Definitions:** Store custom fields defined by tenants in `field_definitions` (api_name, data_type, validation_rules).
2. **Dynamic JSONB Validator:** An engine to validate a record's dynamic custom fields JSONB object against the defined `field_definitions` for the tenant.
3. **Form Layout Compiler:** Support custom form layout configuration objects containing structured layout metadata for rendering CRM record forms.

## Security & Verification Requirements
1. **Dynamic Field Validation Tests:** Ensure validation succeeds when input matches data types (e.g., text, number) and validation constraints, and fails when data types mismatch.
2. **TypeScript / Lint Compilation:** All code must compile cleanly via `pnpm verify` with zero warnings or errors.
