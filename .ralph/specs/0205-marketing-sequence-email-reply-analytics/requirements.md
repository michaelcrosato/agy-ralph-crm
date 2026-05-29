# Specification: Marketing Sequence Email Reply Analytics - Requirements

## 1. Functional Requirements

### 1.1 Granular Reply Event Logging
- The system MUST log an email reply event whenever a reply is received for a tracked email.
- The reply tracking endpoint `POST /api/public/emails/track/reply/:token` MUST accept a tracker `token` via URL parameter.
- The endpoint MUST accept optional `replyBody` and `senderEmail` in the request body. If `senderEmail` is not provided, it MUST fall back to a default value or be extracted from the associated recipient record.
- The system MUST automatically categorize the sentiment of the reply body:
  - If the reply body contains keywords like `"interested"`, `"yes"`, `"please"`, `"great"`, or `"thank"`, it MUST be categorized as `"positive"`.
  - If the reply body contains keywords like `"remove"`, `"stop"`, `"unsubscribe"`, `"not interested"`, or `"no"`, it MUST be categorized as `"negative"`.
  - Otherwise, it MUST be categorized as `"neutral"`.
- Logging a reply MUST increment the matching `email_trackers` record's `replyCount` and update `lastRepliedAt` timestamp.
- The reply event MUST be logged in a dedicated `email_reply_events` table.

### 1.2 Reply Analytics Calculation
The analytical service MUST calculate sequence-level analytics including:
1. `totalUniqueReplies`: The number of unique recipients (trackers) that have at least one reply event.
2. `totalTrackedReplies`: The overall count of all reply events.
3. `replyRate`: The overall reply rate percentage (unique replies / total sent as a formatted string, e.g. `"25.0%"`).
4. `sentimentPerformance`: A breakdown of reply events grouped by sentiment type (positive, neutral, negative) containing:
   - `sentiment`: The sentiment category string.
   - `replyCount`: The absolute count of replies matching this sentiment.
   - `percentage`: The percentage of total replies.
5. `stepReplyRates`: A list of steps belonging to the sequence containing:
   - `stepId`: The UUID of the sequence step.
   - `stepName`: The sequence step name.
   - `totalSent`: The number of emails sent for this step (matching the step's activity count).
   - `uniqueReplies`: The number of unique recipients who replied to this step's email.
   - `replyRate`: The calculated reply rate percentage (uniqueReplies / totalSent as string, e.g. `"20.0%"`). If `totalSent` is 0, it should be `"0.0%"`.

### 1.3 Tenant RLS Isolation
- The analytics API MUST only return reply analytics data belonging to the authenticated tenant organization.
- Cross-tenant data leaks MUST be strictly prohibited.

## 2. Interface Contracts

### 2.1 API Endpoint Definitions

#### POST /api/public/emails/track/reply/:token
- Path Parameter: `token` (String, tracking token of the email)
- Body (JSON):
  ```json
  {
    "replyBody": "Yes, I am interested! Please call me tomorrow.",
    "senderEmail": "prospect@example.com"
  }
  ```
- Response: `200 OK`
  ```json
  {
    "success": true,
    "message": "Reply event tracked successfully"
  }
  ```

#### GET /api/sequences/:id/replies-analytics
- Path Parameter: `id` (UUID of the marketing sequence)
- Headers: `Authorization: Bearer <tenant-token>`
- Response: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "totalUniqueReplies": 3,
      "totalTrackedReplies": 4,
      "replyRate": "30.0%",
      "sentimentPerformance": [
        {
          "sentiment": "positive",
          "replyCount": 2,
          "percentage": "50.0%"
        },
        {
          "sentiment": "neutral",
          "replyCount": 1,
          "percentage": "25.0%"
        },
        {
          "sentiment": "negative",
          "replyCount": 1,
          "percentage": "25.0%"
        }
      ],
      "stepReplyRates": [
        {
          "stepId": "step-uuid-1",
          "stepName": "Welcome Email",
          "totalSent": 10,
          "uniqueReplies": 3,
          "replyRate": "30.0%"
        }
      ]
    }
  }
  ```
