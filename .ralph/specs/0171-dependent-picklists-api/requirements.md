# Specification: Dependent Picklists & Field Value Matrix API - Requirements

## 1. Functional Requirements

### 1.1 Picklist Dependency Definition
- Tenants must be able to define picklist dependencies for specific object types (`leads`, `accounts`, `contacts`, `opportunities`).
- A picklist dependency consists of:
  - `parentField`: The controlling field (e.g. `Country` or standard `status`/`stage` field, or a custom picklist field).
  - `dependentField`: The dependent field (must be a picklist data type).
  - `dependencyMap`: A dictionary mapping each parent value option to an array of valid dependent value options.
- The controlling and dependent fields can be standard fields or custom fields defined via `field_definitions`.

### 1.2 Validation Enforcement
- When a CRM record (Lead, Account, Contact, Opportunity) is created or updated, the validation engine must load all active picklist dependency configurations for that object type.
- For each active dependency rule:
  - If the record contains both the `parentField` and the `dependentField` (in either custom JSONB field or top-level properties):
    - Retrieve the controlling field value and the dependent field value.
    - If the controlling field value is not present in the `dependencyMap`, or if the dependent field value is not one of the allowed values configured for that controlling value, validation must fail.
  - If the validation fails, the API must throw a descriptive HTTP 400 Bad Request error indicating which field has an invalid value and what the allowed values are.

### 1.3 Tenant Security (RLS)
- A tenant can only create, retrieve, list, or delete picklist dependency rules belonging to their own organization (`orgId`).
- Evaluation of rules must strictly use the rules belonging to the active tenant's context.

---

## 2. Interface Requirements

### 2.1 REST API Routes
- **`POST /api/metadata/picklist-dependencies`**
  - Payload: `{ objectType: string, parentField: string, dependentField: string, dependencyMap: Record<string, string[]> }`
  - Response: Fully saved dependency object with standard generated UUID.
- **`GET /api/metadata/picklist-dependencies`**
  - Response: Array of picklist dependency rules matching the tenant org.
- **`DELETE /api/metadata/picklist-dependencies/:id`**
  - Response: `{ success: boolean }`
