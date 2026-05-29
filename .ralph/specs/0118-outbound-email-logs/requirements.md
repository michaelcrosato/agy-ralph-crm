# Specification: Outbound Email Log Adapters & Service Activity Integrations - Requirements

## 1. Functional Requirements

### 1.1 Outbound Email Validation Utility
- **REQ-1.1.1**: The system must expose a pure utility function in `packages/core` to validate outbound email logs.
- **REQ-1.1.2**: Validation must ensure that:
  - `from` is a valid, single email address.
  - `to` is a non-empty array of valid email addresses.
  - `cc` and `bcc` (if provided) are arrays of valid email addresses.
  - `subject` and `body` are non-empty strings.

### 1.2 Multi-Tenant Logging REST API
- **REQ-1.2.1**: Expose `POST /api/emails/log` protected by `tenantAuth`.
- **REQ-1.2.2**: The endpoint must accept:
  ```json
  {
    "from": "user@tenant.com",
    "to": ["contact@client.com"],
    "cc": [],
    "bcc": [],
    "subject": "Introductory Meeting",
    "body": "Hello...",
    "links": [
      { "targetType": "Contact", "targetId": "contact-123" }
    ]
  }
  ```
- **REQ-1.2.3**: If the input email is invalid, the endpoint must return a 400 Bad Request status code.
- **REQ-1.2.4**: When logging an email, the system must:
  - Verify that all linked entities exist and belong to the active tenant. If any entity is mismatched or missing, abort and return a 403 Forbidden or 404 Not Found error.
  - Create a `DBActivity` record of `type: "email"` with the parsed message content, including a `custom` field containing `from`, `to`, `cc`, and `bcc` properties.
  - Create corresponding `DBActivityLink` records to bind the activity to each target.
  - Log an audit trail entry (`DBAuditLog`) of `action: "create"` and `recordType: "EmailLog"`.

### 1.3 Outbound Email Retrieval REST API
- **REQ-1.3.1**: Expose `GET /api/emails/:id` returning the logged email details and linked objects, returning a 404 if not found or if the request bypasses tenant boundary isolation.

## 2. Technical & Security Requirements
- **REQ-2.1**: Active Row-Level Security (RLS) context must prevent cross-tenant leakage. Any access attempt from Tenant B to Tenant A's logged emails must fail with a 404.
- **REQ-2.2**: TypeScript compilation and lint checks must pass cleanly across the workspace.
