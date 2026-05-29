# Specification: Marketing Sequence Email Granular Bounce & Spam Complaint Events & Bounce Analytics - Requirements

## 1. Functional Requirements

### 1.1 Granular Bounce & Spam Complaint Event Logging
- The system MUST log an email bounce or complaint event whenever a bounce or complaint is received for a tracked email.
- The bounce tracking endpoint `POST /api/public/emails/track/bounce/:token` MUST accept a tracker `token` via URL parameter.
- The endpoint MUST accept optional `eventType` ("bounce" | "complaint"), `bounceType` ("hard" | "soft" | "spam_complaint"), and `bounceReason` in the request body.
- If `eventType` is `"complaint"`, `bounceType` MUST be categorized as `"spam_complaint"`.
- If `eventType` is `"bounce"` and `bounceType` is not provided, it MUST default to `"hard"`.
- Tracking a bounce or complaint MUST:
  - Increment the matching `email_trackers` record's `bounceCount` and update `lastBouncedAt` timestamp.
  - Create suppression records via `handleEmailDeliveryEvent` to suspend future communications to this recipient.
  - Log a granular event record in the `email_bounce_events` table.
- Row-Level Security (RLS) MUST be strictly enforced on all databases and stores so that one tenant's bounce data cannot leak to another.

### 1.2 Bounce Analytics Calculation
The analytical service MUST calculate sequence-level bounce analytics including:
1. `totalBounces`: The count of all bounce events where `eventType = "bounce"`.
2. `totalComplaints`: The count of all bounce events where `eventType = "complaint"`.
3. `totalUniqueBouncedTrackers`: The number of unique recipients (trackers) that have at least one bounce or complaint event.
4. `bounceRate`: The overall bounce rate percentage (totalUniqueBouncedTrackers / totalSent as a formatted string, e.g., `"5.0%"`).
5. `bounceTypePerformance`: A breakdown of events grouped by `bounceType` (hard, soft, spam_complaint) containing:
   - `bounceType`: The bounce category string.
   - `eventCount`: The absolute count of events.
   - `percentage`: The percentage of total bounce and complaint events.
6. `stepBounceRates`: A list of steps belonging to the sequence containing:
   - `stepId`: The UUID of the sequence step.
   - `stepName`: The sequence step name.
   - `totalSent`: The number of emails sent for this step.
   - `uniqueBounces`: The number of unique recipients who bounced or complained on this step's email.
   - `bounceRate`: The calculated bounce rate percentage (uniqueBounces / totalSent as string, e.g., `"2.0%"`). If `totalSent` is 0, it should be `"0.0%"`.

### 1.3 Tenant RLS Isolation
- The analytics API MUST only return bounce and complaint analytics data belonging to the authenticated tenant organization.
- Cross-tenant data leaks MUST be strictly prohibited.

## 2. Interface Contracts

### 2.1 API Endpoint Definitions

#### POST /api/public/emails/track/bounce/:token
- Path Parameter: `token` (String, tracking token of the email)
- Body (JSON):
  ```json
  {
    "eventType": "bounce",
    "bounceType": "hard",
    "bounceReason": "550 User Unknown"
  }
  ```
- Response: `200 OK`
  ```json
  {
    "success": true,
    "message": "Bounce event tracked successfully"
  }
  ```

#### GET /api/sequences/:id/bounces-analytics
- Path Parameter: `id` (UUID of the marketing sequence)
- Headers: `Authorization: Bearer <tenant-token>`
- Response: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "totalBounces": 2,
      "totalComplaints": 1,
      "totalUniqueBouncedTrackers": 2,
      "bounceRate": "20.0%",
      "bounceTypePerformance": [
        {
          "bounceType": "hard",
          "eventCount": 2,
          "percentage": "66.7%"
        },
        {
          "bounceType": "spam_complaint",
          "eventCount": 1,
          "percentage": "33.3%"
        },
        {
          "bounceType": "soft",
          "eventCount": 0,
          "percentage": "0.0%"
        }
      ],
      "stepBounceRates": [
        {
          "stepId": "step-uuid-1",
          "stepName": "Welcome Email",
          "totalSent": 10,
          "uniqueBounces": 2,
          "bounceRate": "20.0%"
        }
      ]
    }
  }
  ```
