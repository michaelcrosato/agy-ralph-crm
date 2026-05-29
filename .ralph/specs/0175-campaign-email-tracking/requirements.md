# Specification: Campaign Email Open & Click Tracking API - Requirements

## 1. Functional Requirements

### 1.1 Tracker Creation and Token Generation
- An authenticated user can create a tracking configuration for an existing Activity of type `"email"`.
- The system must generate a unique, cryptographically secure or highly random tracking token.
- The default open count and click count must be `0`.
- The `activityId` and tracker must belong to the active tenant.

### 1.2 Public Email Open Tracking
- Public GET endpoint: `/api/public/emails/track/open/:token`
- It must not require tenant authentication (public access).
- When hit:
  - If the token exists, increment `openCount` and set `lastOpenedAt` to the current time.
  - Incrementing the open count must record a timeline update or audit log entry.
  - Return a valid transparent 1x1 GIF or PNG pixel with appropriate caching headers (`no-cache`, `no-store`, `must-revalidate`).
  - If the token does not exist, it should still return the transparent 1x1 pixel (graceful failure to avoid broken images in user clients).

### 1.3 Public Email Link Click Tracking
- Public GET endpoint: `/api/public/emails/track/click/:token`
- It must accept a query parameter `target` containing the URL to redirect to.
- It must not require tenant authentication.
- When hit:
  - If the token exists, increment `clickCount` and set `lastClickedAt` to the current time.
  - Redirect the user to the destination URL specified by the `target` query parameter using HTTP `302 Found` or `307 Temporary Redirect`.
  - If the token does not exist or target is missing, return `400 Bad Request` or default to redirecting to the CRM home/welcome page.

### 1.4 Tracker Querying & Tenancy Boundaries
- Authenticated GET endpoint: `/api/emails/:activityId/tracker`
- The email activity and tracker must exist and belong to the active tenant.
- Any attempt to query tracking statistics for a different tenant's email tracker must result in `404 Not Found` or `403 Forbidden` RLS enforcement.

## 2. Non-Functional & Security Requirements
- **Tenant Isolation**: Strictly isolate all tracking records at the database and memory store level.
- **Robustness**: The public endpoints must never crash or expose internal system details, even when queried with invalid tokens.
