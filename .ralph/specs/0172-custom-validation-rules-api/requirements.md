# Specification: Custom Validation Rules Engine API - Requirements

## 1. Functional Requirements

### 1.1 Custom Validation Rule Definition
- Tenants must be able to define custom validation rules for specific object types (`leads`, `accounts`, `contacts`, `opportunities`).
- A custom validation rule consists of:
  - `name`: A descriptive name for the rule (e.g. "Min Opportunity Amount").
  - `description`: Optional text describing what the rule does.
  - `objectType`: The CRM object type (`leads`, `accounts`, `contacts`, `opportunities`).
  - `errorMessage`: The custom message returned when validation fails (e.g. "Amount cannot be less than 500 when Stage is Needs Analysis").
  - `isActive`: Flag indicating whether the rule is active (1 = active, 0 = inactive).
  - `criteria`: A structured set of conditions representing the *error condition* (i.e. when evaluated to `true`, validation fails and the save is blocked).
- The `criteria` should support standard conditions, e.g., mapping field paths to expected values, or comparing field values (using standard condition operators like `equals`, `not_equal`, `greater_than`, `less_than`, `contains`).

### 1.2 Validation Enforcement
- When a CRM record (Lead, Account, Contact, Opportunity) is created or updated, the validation engine must load all active validation rules for that object type and tenant.
- For each active validation rule:
  - The engine evaluates the record's standard and custom fields against the `criteria` (the error condition).
  - If the `criteria` evaluates to `true`, the validation fails.
- If any validation rule fails, the API must block the mutation and return an HTTP 400 Bad Request error containing the custom `errorMessage`.

### 1.3 Tenant Security (RLS)
- A tenant can only create, retrieve, list, or delete validation rules belonging to their own organization (`orgId`).
- Evaluation of validation rules must strictly use the rules belonging to the active tenant's context.

---

## 2. Interface Requirements

### 2.1 REST API Routes
- **`POST /api/metadata/validation-rules`**
  - Payload: `{ name: string, description?: string, objectType: string, errorMessage: string, criteria: any, isActive?: number }`
  - Response: Fully saved validation rule object with a generated UUID.
- **`GET /api/metadata/validation-rules`**
  - Response: Array of validation rules matching the tenant org.
- **`DELETE /api/metadata/validation-rules/:id`**
  - Response: `{ success: boolean }`
