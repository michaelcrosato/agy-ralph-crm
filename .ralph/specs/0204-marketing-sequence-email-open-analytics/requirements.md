# Specification: Marketing Sequence Email Open Analytics - Requirements

## 1. Functional Requirements

### 1.1 Granular Open Event Logging
- The system MUST log an open event whenever an email is opened.
- The open tracking endpoint MUST accept a tracker `token` via URL parameter.
- The open tracking endpoint MUST capture the IP address and User Agent.
- The system MUST automatically parse the User Agent to determine the device type:
  - If the User Agent contains `"Mobi"` or `"Android"` or `"iPhone"`, it MUST be classified as `"mobile"`.
  - If the User Agent contains `"iPad"` or `"Tablet"`, it MUST be classified as `"tablet"`.
  - Otherwise, it MUST be classified as `"desktop"`.
- Logging an open MUST increment the matching `email_trackers` record's `openCount` and update `lastOpenedAt` timestamp.

### 1.2 Open Analytics Calculation
The analytical service MUST calculate sequence-level analytics including:
1. `totalUniqueOpens`: The number of unique recipients (trackers) that have at least one open event.
2. `totalTrackedOpens`: The overall count of all open events.
3. `devicePerformance`: A breakdown of open events grouped by device type (desktop, mobile, tablet) containing:
   - `deviceType`: The device category string.
   - `openCount`: The absolute count of opens on this device.
   - `percentage`: The percentage of total opens.
4. `stepOpenRates`: A list of steps belonging to the sequence containing:
   - `stepId`: The UUID of the sequence step.
   - `stepName`: The sequence step name.
   - `totalSent`: The number of emails sent for this step (matching the step's activity count).
   - `uniqueOpens`: The number of unique recipients who opened this step's email.
   - `openRate`: The calculated open rate percentage (uniqueOpens / totalSent as string, e.g., `"75.0%"`). If `totalSent` is 0, it should be `"0.0%"`.

### 1.3 Tenant RLS Isolation
- The analytics API MUST only return open analytics data belonging to the authenticated tenant organization.
- Cross-tenant data leaks MUST be strictly prohibited.

## 2. Interface Contracts

### 2.1 API Endpoint Definitions

#### POST /api/emails/track-open/:token
- Path Parameter: `token` (String, tracking token of the email)
- Body: JSON containing `ipAddress` and `userAgent` (optional, fallback to header/default values if missing)
- Response: `200 OK`
  ```json
  {
    "success": true,
    "message": "Open event tracked successfully"
  }
  ```

#### GET /api/sequences/:id/opens-analytics
- Path Parameter: `id` (UUID of the marketing sequence)
- Headers: `Authorization: Bearer <tenant-token>`
- Response: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "totalUniqueOpens": 5,
      "totalTrackedOpens": 8,
      "devicePerformance": [
        {
          "deviceType": "desktop",
          "openCount": 5,
          "percentage": "62.5%"
        },
        {
          "deviceType": "mobile",
          "openCount": 3,
          "percentage": "37.5%"
        }
      ],
      "stepOpenRates": [
        {
          "stepId": "step-uuid-1",
          "stepName": "Welcome Email",
          "totalSent": 10,
          "uniqueOpens": 5,
          "openRate": "50.0%"
        }
      ]
    }
  }
  ```
