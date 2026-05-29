# Task 0164: CSV Data Import Wizard & Column Mapping Engine - Brief

## Objective
Establish an enterprise-grade CSV import wizard and dynamic column mapping engine for the CRM Core system under Phase 6. This allows customers to upload bulk Leads or Contacts in CSV format, define custom column mappings to standard and custom CRM fields, perform dry-run validations with granular error reporting, and execute RLS-secured bulk insertions under the active tenant context.

## Core Value
- **Enterprise-Grade Data Ingestion**: Simplifies migration of large datasets into the CRM system.
- **Dynamic Field Mapping**: Maps dynamic headers to standard fields (e.g. `company`, `email`, `status`) and validates dynamic custom fields.
- **Safety & Dry-Run Validation**: Evaluates entire CSV payload to output row-by-row diagnostic errors prior to executing mutations.
- **Tenant Isolation Protection**: Guarantees all imported records are isolated under the active tenant context using the standard RLS engine.
