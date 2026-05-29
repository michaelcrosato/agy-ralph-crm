# Specification: Campaign Unsubscribe & Recipient Opt-Out API - Requirements

## 1. Functional Requirements

### 1.1 Public Unsubscribe Route
- The API must expose a public HTTP endpoint: `GET /api/public/emails/unsubscribe/:token`.
- The endpoint must NOT require any `Authorization` header or session token.
- When invoked:
  1. The API must query `email_trackers` by the unique `token`.
  2. If the tracker is found, it must run the opt-out mutations within the organization context (`orgId`) of that tracker.
  3. If the tracker is not found, the endpoint should return a `404 Not Found` response.

### 1.2 Unsubscription & Opt-Out Mutations
- Within the resolved tenant context, the system must retrieve all `activity_links` linked to the tracker's `activityId`.
- For each `activityLink`:
  - If `targetType === "Lead"`, the system must update or insert a `contact_consent_preferences` record for the Lead (`recordId = targetId`, `recordType = "lead"`), setting:
    - `channel = "email"`
    - `status = "opt_out"`
    - `source = "public_unsubscribe"`
    - `updatedById = "00000000-0000-0000-0000-000000000000"` (System User)
  - If `targetType === "Contact"`, the system must update or insert a `contact_consent_preferences` record for the Contact (`recordId = targetId`, `recordType = "contact"`), setting:
    - `channel = "email"`
    - `status = "opt_out"`
    - `source = "public_unsubscribe"`
    - `updatedById = "00000000-0000-0000-0000-000000000000"` (System User)
- After registering the unsubscribe preferences, the system must generate corresponding audit logs recording the upsert action for `contact_consent_preferences`.

### 1.3 Response UX
- If the unsubscription is successful, the endpoint must return a clean, friendly HTML page to the browser confirming that the user has been unsubscribed (Content-Type: `text/html`).
- The HTML response should look highly professional and clear, avoiding plain unstyled text.

## 2. Non-Functional & Security Requirements

### 2.1 Multi-Tenant Isolation (RLS)
- The public route must safely resolve the correct `orgId` from the tracking token, but must execute the db updates strictly within that org context using the `withTenant` wrapper.
- A request with a valid token for Tenant A must never alter or access records belonging to Tenant B.
- All authenticated REST operations on consent preferences or trackers must strictly enforce standard session-based RLS boundaries.

### 2.2 Error Handling & Validation
- Incorrect or malformed tokens must result in an immediate `404 Not Found` or `400 Bad Request` without revealing internal stack traces.
