# Specification: Marketing Sequence Bounce & Spam Protection / Handling - Requirements

## 1. Functional Requirements

### 1.1 suppression Record Creation
- When a `bounce` or `complaint` delivery event is received for an email address, a record MUST be created in the `marketing_sequence_suppressions` table.
- The `reason` field MUST be set to `"bounce"` or `"complaint"` respectively.
- The `recordType` field MUST be `"lead"` if the email belongs to a lead, `"contact"` if it belongs to a contact, or `"email_domain"` if it is a general suppression.
- The `pattern` field MUST store the exact email address (e.g. `"user@domain.com"`).

### 1.2 Sequence Membership Exit
- The engine MUST identify all active (`status = "active"`) or snoozed (`status = "snoozed"`) memberships in `marketing_sequence_memberships` associated with the matched Lead or Contact email.
- The matching memberships MUST have their `status` updated to `"exited"`.
- The `nextExecutionAt` and `snoozeUntil` fields MUST be cleared (set to `null`) to prevent any future step executions.

### 1.3 Lead & Contact Profile Updates
- If a Lead record is found matching the email, its custom metadata state (`custom.email_status` or similar) MUST be updated to reflect the delivery status (e.g. `"bounced"` or `"complained"`).
- If a Contact record is found matching the email, its custom metadata state MUST be updated similarly.

### 1.4 Audit Trail Logging
- For every membership exited due to a bounce or complaint event, an audit log MUST be inserted in `auditLogs`.
- The `action` field of the audit log MUST be `"membership_exit_bounce"` or `"membership_exit_complaint"`.
- The audit log details MUST specify the status transitions (from `"active"` or `"snoozed"` to `"exited"`).

---

## 2. API & Endpoint Requirements

### 2.1 Webhook Endpoint
- The Hono API shell MUST expose a route: `POST /api/sequences/email-event`.
- The route payload format MUST be a JSON object:
  ```json
  {
    "email": "recipient@example.com",
    "event": "bounce" | "complaint",
    "reason": "Hard bounce - User unknown"
  }
  ```
- The route MUST execute the core handling engine in a single transactional or unified context.

---

## 3. Row-Level Security (RLS) & Tenancy Requirements
- All database operations MUST run under the strict tenant context propagated via Hono API middleware or AsyncLocalStorage.
- A tenant MUST only be able to trigger events or create suppressions for records belonging to their own organization (`orgId`).
- Processing an event for an email that belongs to a different tenant org MUST fail or silently skip the action to prevent data cross-contamination.
