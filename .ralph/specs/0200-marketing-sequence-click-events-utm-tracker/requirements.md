# Specification: Marketing Sequence Email Granular Click Events & UTM Tracking - Requirements

## 1. Functional Requirements

### 1.1 Granular Click Event Logging
- Every click on a tracking link (`GET /api/public/emails/track/click/:token?target=...`) MUST be logged as a discrete event in the `email_click_events` table.
- The logged event MUST capture:
  - `trackerId`: UUID of the parent `email_trackers` record.
  - `clickedUrl`: The exact URL the recipient clicked (e.g. the `target` parameter).
  - `ipAddress`: The request IP address (from headers `x-forwarded-for`, `cf-connecting-ip`, or fallback to `"127.0.0.1"` if missing).
  - `userAgent`: The User-Agent header value (fallback to `"Unknown"` if missing).
  - parsed UTM parameters: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` parsed dynamically from the `target` URL query parameters.
- If the clicked `target` URL contains no UTM parameters, the UTM fields in the database MUST be set to `null` or empty strings.
- Aggregate metrics on the parent `email_trackers` (such as `clickCount` and `lastClickedAt`) MUST continue to be incremented accurately.

### 1.2 Click Events Retrieval API
- Logged-in users MUST be able to query the list of granular click events for any email tracker.
- Endpoint: `GET /api/emails/trackers/:trackerId/clicks`
- The endpoint MUST return a list of click event records sorted chronologically (`createdAt` descending).

### 1.3 Tenant RLS Isolation
- Public track click routes MUST operate strictly in the organization context of the tracker.
- Active tenant RLS isolation MUST be enforced:
  - Users can ONLY query click events of email trackers belonging to their active organization.
  - Querying another tenant's `trackerId` clicks MUST throw a 403 or return an empty/unauthorized response.
  - No database insertion or modification of click events should cross tenant boundaries.

## 2. Interface Contracts

### 2.1 Schema Definition
`email_click_events` table columns:
- `id`: uuid (primary key)
- `org_id`: uuid (foreign key to `organizations`, cascade delete)
- `tracker_id`: uuid (foreign key to `email_trackers`, cascade delete)
- `clicked_url`: text (not null)
- `ip_address`: text (not null)
- `user_agent`: text (not null)
- `utm_source`: text
- `utm_medium`: text
- `utm_campaign`: text
- `utm_term`: text
- `utm_content`: text
- `created_at`: timestamp (default now)

### 2.2 Endpoints Definition
- `GET /api/emails/trackers/:trackerId/clicks`
  - Response: `200 OK` with JSON:
    ```json
    {
      "clicks": [
        {
          "id": "event-uuid",
          "trackerId": "tracker-uuid",
          "clickedUrl": "https://example.com/page?utm_source=newsletter",
          "ipAddress": "127.0.0.1",
          "userAgent": "Mozilla/5.0 ...",
          "utmSource": "newsletter",
          "utmMedium": "email",
          "utmCampaign": "summer_sale",
          "utmTerm": null,
          "utmContent": null,
          "createdAt": "2026-05-29T00:00:00.000Z"
        }
      ]
    }
    ```
