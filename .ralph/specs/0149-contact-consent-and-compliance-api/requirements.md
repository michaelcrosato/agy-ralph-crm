# Specification: Contact Consent & GDPR Compliance API - Requirements

## 1. Functional Requirements

### 1.1 Consent Preference Storage
- The system must capture consent preferences at the granular level of a specific Lead or Contact, a specific channel, and a tenant organization.
- Supported Channels:
  - `"email"`
  - `"sms"`
  - `"phone"`
- Supported Statuses:
  - `"opt_in"` (explicitly allowed)
  - `"opt_out"` (explicitly disallowed/opted out)
  - `"pending"` (under review or double-opt-in waiting)
- If a Lead or Contact does not have any recorded consent preference, the system should treat the status as `"pending"` (which defaults to blocked for marketing communications).

### 1.2 Consent Preferences Management & Tracking
- Tenants must be able to create or update communication preferences for any Contact or Lead.
- Upserting consent must capture:
  - `recordType`: `"contact"` or `"lead"`.
  - `recordId`: The target Contact or Lead ID.
  - `channel`: The target channel (`"email"`, `"sms"`, or `"phone"`).
  - `status`: The preference status (`"opt_in"`, `"opt_out"`, or `"pending"`).
  - `source`: The source of the opt-in/opt-out change (e.g. `"web_form"`, `"manual"`, `"api"`).
  - `updatedById`: The user ID committing the change.
- A single record/row should exist per combination of `(orgId, recordType, recordId, channel)`. Subsequent updates must overwrite the preference status and record the update details.

### 1.3 Communication Verification Engine
- A core validation engine must take a channel and the list of existing consent rules for a record to determine contactability:
  - If a rule exists with status `"opt_in"`, communication is allowed (returns `true`).
  - If a rule exists with status `"opt_out"`, communication is blocked (returns `false`).
  - If no rule exists, or the status is `"pending"`, communication is blocked by default (returns `false`).

### 1.4 Multi-Tenant Row-Level Security
- Consent preferences must be strictly isolated at the database store level.
- A tenant must only be able to view, query, create, or update consent rules belonging to their own organization context.
- Consent preferences for one organization must never be accessible or mutable by users of another organization.

---

## 2. Non-Functional & API Requirements

### 2.1 REST Endpoints

#### `GET /api/consent`
- Queries consent preferences for a specific record.
- Query parameters:
  - `recordType`: `"lead"` or `"contact"` (required)
  - `recordId`: UUID of the Lead or Contact (required)
- Returns HTTP 200 on success.
- Response format:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "string (UUID)",
        "recordType": "contact",
        "recordId": "string (UUID)",
        "channel": "email",
        "status": "opt_in",
        "source": "web_form",
        "updatedById": "string (UUID)",
        "updatedAt": "string (ISO)"
      }
    ]
  }
  ```

#### `POST /api/consent`
- Sets or updates a consent preference.
- Payload body parameters:
  - `recordType`: `"lead"` or `"contact"` (required)
  - `recordId`: UUID (required)
  - `channel`: `"email"` | `"sms"` | `"phone"` (required)
  - `status`: `"opt_in"` | `"opt_out"` | `"pending"` (required)
  - `source`: string (required)
- Returns HTTP 200 on success with the updated preference object.
- Response format:
  ```json
  {
    "success": true,
    "data": {
      "id": "string (UUID)",
      "recordType": "contact",
      "recordId": "string (UUID)",
      "channel": "email",
      "status": "opt_in",
      "source": "web_form",
      "updatedById": "string (UUID)",
      "updatedAt": "string (ISO)"
    }
  }
  ```

### 2.2 Security Gateways
- All endpoints must require a valid authentication header containing a JWT session token.
- Returns HTTP 401 Unauthorized if the token is missing or invalid.
