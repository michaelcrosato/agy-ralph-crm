# Specification: Marketing Sequence Personalization Engine - Requirements

## 1. Functional Requirements

### 1.1 advanced Placeholder Resolving
- The engine must parse placeholders matching `{{path.to.val}}` or `{{path.to.val | filter("args") | filter2}}`.
- The engine must support:
  - `default("string")`: Returns the fallback string if the value is null, undefined, empty string `""`, or `[N/A]`.
  - `uppercase`: Converts the resolved string to uppercase.
  - `lowercase`: Converts the resolved string to lowercase.
- The engine must support chaining multiple filters (e.g. `{{lead.company | default("standard") | uppercase}}`).

### 1.2 Conditional Blocks
- The engine must parse and render simple conditional blocks:
  `{% if path.to.val %}true text{% else %}false text{% endif %}`
- If the target path evaluates to a truthy value (i.e. not null, undefined, empty, or false), the true text is rendered; otherwise, the false text is rendered.
- The condition blocks can contain nested placeholders (e.g. `{% if lead.company %}working at {{lead.company}}{% else %}self-employed{% endif %}`).

### 1.3 Endpoint Preview API
- The preview endpoint `POST /api/sequences/preview` must require authentication and tenant headers.
- It must accept a JSON body containing:
  - `subject`: The template subject.
  - `body`: The template body.
  - `recordType`: `"lead"` | `"contact"`.
  - `recordId`: UUID of the lead or contact record.
- It must fetch the record under the active tenant context and return a JSON payload with `subject` and `body` fully resolved.
- If the record does not exist or belongs to another tenant, the request must fail with a strict RLS context exception or 404 error.

## 2. Non-Functional & Security Requirements
- **Tenant Isolation**: Direct database access to contacts/leads must validate that `org_id` matches the active tenant context (`getActiveOrgId()`).
- **No External Dependencies**: Custom parsing rules must be implemented using vanilla TypeScript to maintain low token overhead and execution efficiency.
- **Robust Error Handling**: If a template contains invalid placeholders or filters, it must fallback gracefully instead of throwing compiler crashes.
