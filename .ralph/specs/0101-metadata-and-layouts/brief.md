# Specification: Metadata API & Dynamic Field Customization - Brief

## Objective
Establish the Hono REST API endpoints for registered custom field definitions and dynamic form layouts. Extend Lead creation and conversion workflows to dynamically validate custom JSONB fields against tenant-defined metadata rules.

## Boundaries & Constraints
- Field and layout definition tables and isolated RLS accessors must reside in `packages/db`.
- Dynamic JSONB verification logic and form layout compilation routines must reside in `packages/metadata`.
- API endpoints for registering definitions, configuring layout sections, and performing validation must reside in `apps/api`.
- All routes must be authenticated and execute under strict tenant isolation.
