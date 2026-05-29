# Specification: Custom Validation Rules Engine API - Brief

## 1. Functional Objective
This feature introduces a dynamic Custom Validation Rules Engine for CRM records (Leads, Accounts, Contacts, Opportunities).
It allows tenants to define custom data validation rules consisting of a criteria-based error condition and a corresponding custom error message (e.g. "Opportunity Amount cannot be less than 500 when Stage is 'Needs Analysis'", or "Lead Email is required when Status is 'Working'").
When records are created or updated, the system evaluates active validation rules for that object type and tenant. If the error condition is met, the mutation is blocked and the custom error message is returned to the user.

## 2. Technical Scope
- **Tenancy Isolation**: Validation rules must be stored and evaluated strictly within active tenant RLS bounds.
- **REST Endpoints**:
  - `POST /api/metadata/validation-rules` - Register/create a custom validation rule.
  - `GET /api/metadata/validation-rules` - List active validation rules for the tenant.
  - `DELETE /api/metadata/validation-rules/:id` - Delete an active validation rule.
- **Validation Engine**:
  - Implement a validation rules engine in the core business logic layer that evaluates fields against active rules.
  - Validate custom and standard fields during Lead, Account, Contact, and Opportunity creations and mutations.
- **Verification**: Complete unit and integration tests asserting RLS isolation, valid state verification, invalid state mutations blocking, and correct audit trail behavior.
