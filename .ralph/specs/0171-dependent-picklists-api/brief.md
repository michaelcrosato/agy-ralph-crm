# Specification: Dependent Picklists & Field Value Matrix API - Brief

## 1. Functional Objective
This feature introduces a dynamic Dependent Picklist and Field Value Matrix validation engine for CRM records (Leads, Accounts, Contacts, Opportunities).
It allows tenants to define picklist dependency rules (e.g. parent controlling field vs. dependent child field, such as `Country` controlling `State`, or `Industry` controlling `Sub-Industry`).
When records are created or updated, the system automatically validates that the dependent field's value conforms to the permitted options mapped by the controlling field's current value.

## 2. Technical Scope
- **Tenancy Isolation**: Picklist dependency rules and validation matrices must be stored and evaluated strictly within active tenant RLS bounds.
- **REST Endpoints**:
  - `POST /api/metadata/picklist-dependencies` - Register/create a picklist dependency configuration rule.
  - `GET /api/metadata/picklist-dependencies` - List active picklist dependency configurations for the tenant.
  - `DELETE /api/metadata/picklist-dependencies/:id` - Delete an active picklist dependency configuration.
- **Validation Engine**:
  - Implement the picklist dependency validation checks in the core business logic layer.
  - Validate custom and standard fields during Lead, Account, Contact, and Opportunity creations and mutations.
- **Verification**: Complete unit and integration tests asserting RLS isolation, valid state verification, invalid state rejections, and correct audit trail entries.
