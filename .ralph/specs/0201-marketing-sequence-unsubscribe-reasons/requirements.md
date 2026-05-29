# Specification: Marketing Sequence Email Unsubscribe Reasons - Requirements

## 1. Functional Requirements

### 1.1 Unsubscribe Reason Logging
- Recipient can submit their unsubscribe reason via `POST /api/public/emails/unsubscribe/:token/reason`.
- The logged reason MUST capture:
  - `trackerId`: UUID of the parent `email_trackers` record.
  - `reason`: One of standard reasons (`"frequency"`, `"relevance"`, `"not_requested"`, `"other"`).
  - `feedback`: Optional text string detailing additional comments.
- The entry MUST be inserted into the `email_unsubscribes` table and associated with the correct `orgId` matching the tracker's organization.

### 1.2 Unsubscribe Reasons Retrieval API
- Logged-in users MUST be able to query the list of unsubscribe reasons for their organization.
- Endpoint: `GET /api/emails/unsubscribes`
- The endpoint MUST return a list of unsubscribe reason records sorted chronologically (`createdAt` descending).

### 1.3 Tenant RLS Isolation
- Public unsubscribe reason logging route MUST operate strictly in the organization context of the tracker.
- Active tenant RLS isolation MUST be enforced:
  - Users can ONLY query unsubscribe reasons belonging to their active organization.
  - Querying another tenant's unsubscribe reasons MUST be strictly prevented by filtering or raising a permission mismatch error.

## 2. Interface Contracts

### 2.1 Schema Definition
`email_unsubscribes` table columns:
- `id`: uuid (primary key)
- `org_id`: uuid (foreign key to `organizations`, cascade delete)
- `tracker_id`: uuid (foreign key to `email_trackers`, cascade delete)
- `reason`: text (not null)
- `feedback`: text
- `createdAt`: timestamp (default now)

### 2.2 Endpoints Definition
- `POST /api/public/emails/unsubscribe/:token/reason`
  - Body:
    ```json
    {
      "reason": "frequency",
      "feedback": "Too many emails!"
    }
    ```
  - Response: `200 OK` with JSON:
    ```json
    {
      "success": true,
      "data": {
        "id": "event-uuid",
        "trackerId": "tracker-uuid",
        "reason": "frequency",
        "feedback": "Too many emails!",
        "createdAt": "2026-05-29T00:00:00.000Z"
      }
    }
    ```

- `GET /api/emails/unsubscribes`
  - Response: `200 OK` with JSON:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "event-uuid",
          "orgId": "org-uuid",
          "trackerId": "tracker-uuid",
          "reason": "frequency",
          "feedback": "Too many emails!",
          "createdAt": "2026-05-29T00:00:00.000Z"
        }
      ]
    }
    ```
