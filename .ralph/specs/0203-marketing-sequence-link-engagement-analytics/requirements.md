# Specification: Marketing Sequence Link Engagement Analytics - Requirements

## 1. Functional Requirements

### 1.1 Link Engagement Metrics Calculation
The analytical service MUST calculate:
1. `totalTrackedClicks`: The overall count of clicked links for the sequence.
2. `linkPerformance`: A list of unique clicked URLs with:
   - `clickedUrl`: The target URL string.
   - `stepId`: The sequence step ID that sent the email.
   - `stepName`: The sequence step name.
   - `clickCount`: The absolute count of clicks for this specific link.
   - `percentage`: The click's percentage of total clicks in the sequence.

### 1.2 Event to Step Mapping
The system MUST attribute click events to sequence steps by:
- Linking `email_click_events.tracker_id` to `email_trackers` to retrieve the `activity_id`.
- Tracing `activity_id` through `activity_links` to identify the recipient (Lead/Contact ID).
- Matching `email_trackers.activity_id` against standard email activity logs or sequence delivery logs to identify the `step_id` that triggered the mail dispatch.
- Grouping all click events associated with that `step_id` and grouping them by `clicked_url`.

### 1.3 Tenant RLS Isolation
- The analytics API MUST only return link engagement metrics belonging to the authenticated tenant organization.
- Cross-tenant data leaks are strictly prohibited.

## 2. Interface Contracts

### 2.1 API Endpoint Definition
- `GET /api/sequences/:id/links-analytics`
  - Path Parameter: `id` (UUID of the marketing sequence)
  - Headers: `Authorization: Bearer <tenant-token>`
  - Response: `200 OK`
    ```json
    {
      "success": true,
      "data": {
        "totalTrackedClicks": 10,
        "linkPerformance": [
          {
            "clickedUrl": "https://acme.com/demo",
            "stepId": "step-uuid-1",
            "stepName": "Introduction Email",
            "clickCount": 7,
            "percentage": "70.0%"
          },
          {
            "clickedUrl": "https://acme.com/pricing",
            "stepId": "step-uuid-2",
            "stepName": "Follow-up Details",
            "clickCount": 3,
            "percentage": "30.0%"
          }
        ]
      }
    }
    ```
