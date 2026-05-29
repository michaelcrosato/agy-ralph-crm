# Specification: Marketing Sequence Email Read Time Analytics & Scoring - Requirements

## 1. Functional Requirements

### 1.1 Granular Email Read Time Logging & Classification
- The system MUST log an email read-time event when a recipient's read duration is received for a tracked email.
- The tracking endpoint `POST /api/public/emails/track/read-time/:token` MUST accept a tracker `token` via URL parameter and `durationMs` (integer) in the request body.
- The system MUST classify the read event based on `durationMs` using these thresholds:
  - `"glanced"`: less than 2000 milliseconds (< 2 seconds)
  - `"skimmed"`: between 2000 milliseconds and 7999 milliseconds (2 to 8 seconds, inclusive)
  - `"read"`: 8000 milliseconds or more (>= 8 seconds)
- Recording a read-time event MUST:
  - Create a granular event record in the `email_read_time_events` table containing `orgId`, `trackerId`, `durationMs`, and `readClassification`.
  - Update the matching `email_trackers` record's `totalReadTimeMs` by adding the new `durationMs`.
  - Update the matching `email_trackers` record's `lastReadClassification` with the new classification.
- Row-Level Security (RLS) MUST be strictly enforced on all databases and stores so that one tenant's read-time data cannot leak to another.

### 1.2 Read Time Analytics Calculation
The analytical service MUST calculate sequence-level read-time analytics including:
1. `totalGlanced`: The count of all read-time events categorized as `"glanced"`.
2. `totalSkimmed`: The count of all read-time events categorized as `"skimmed"`.
3. `totalRead`: The count of all read-time events categorized as `"read"`.
4. `averageReadTimeMs`: The average read time in milliseconds across all read-time events for this sequence, rounded to the nearest integer. If no events, returns `0`.
5. `readTimeClassificationPerformance`: A breakdown of events grouped by `readClassification` (glanced, skimmed, read) containing:
   - `classification`: The classification category string.
   - `eventCount`: The absolute count of events.
   - `percentage`: The percentage of total read-time events (e.g., `"50.0%"`). If no events, percentage is `"0.0%"`.
6. `stepReadTimeStats`: A list of steps belonging to the sequence containing:
   - `stepId`: The UUID of the sequence step.
   - `stepName`: The sequence step name.
   - `openCount`: The number of opens recorded on this step.
   - `glancedCount`: The number of glanced read-time events recorded on this step.
   - `skimmedCount`: The number of skimmed read-time events recorded on this step.
   - `readCount`: The number of read read-time events recorded on this step.

### 1.3 Tenant RLS Isolation
- The analytics API MUST only return read-time analytics data belonging to the authenticated tenant organization.
- Cross-tenant data leaks MUST be strictly prohibited.

## 2. Interface Contracts

### 2.1 API Endpoint Definitions

#### POST /api/public/emails/track/read-time/:token
- Path Parameter: `token` (String, tracking token of the email)
- Body (JSON):
  ```json
  {
    "durationMs": 4500
  }
  ```
- Response: `200 OK`
  ```json
  {
    "success": true,
    "message": "Read time event tracked successfully"
  }
  ```

#### GET /api/sequences/:id/read-time-analytics
- Path Parameter: `id` (UUID of the marketing sequence)
- Headers: `Authorization: Bearer <tenant-token>`
- Response: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "totalGlanced": 1,
      "totalSkimmed": 2,
      "totalRead": 1,
      "averageReadTimeMs": 4250,
      "readTimeClassificationPerformance": [
        {
          "classification": "glanced",
          "eventCount": 1,
          "percentage": "25.0%"
        },
        {
          "classification": "skimmed",
          "eventCount": 2,
          "percentage": "50.0%"
        },
        {
          "classification": "read",
          "eventCount": 1,
          "percentage": "25.0%"
        }
      ],
      "stepReadTimeStats": [
        {
          "stepId": "step-uuid-1",
          "stepName": "Welcome Email",
          "openCount": 10,
          "glancedCount": 1,
          "skimmedCount": 2,
          "readCount": 1
        }
      ]
    }
  }
  ```
