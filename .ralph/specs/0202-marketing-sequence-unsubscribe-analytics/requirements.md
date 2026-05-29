# Specification: Marketing Sequence Unsubscribe Analytics - Requirements

## 1. Functional Requirements

### 1.1 Aggregated Metrics Calculation
The analytical service MUST calculate:
1. `totalUnsubscribes`: The total number of unsubscribe reasons recorded for the tenant.
2. `reasonBreakdown`: A list of all unique reasons (`"frequency"`, `"relevance"`, `"not_requested"`, `"other"`) with their absolute counts and percentage of the total.
3. `sequenceBreakdown`: A list of sequences with their respective unsubscribe counts and percentage of the total.

### 1.2 Unsubscribe to Sequence Mapping
The system MUST attribute an unsubscribe reason to a sequence by tracing:
- `email_unsubscribes.tracker_id` -> `email_trackers` -> `activity_id` -> `activity_links` -> `target_id` (Lead/Contact ID).
- Matching the `target_id` against `marketing_sequence_memberships` records for the tenant.
- Attributing to the sequence of the unsubscribed membership, or falling back to any sequence the recipient is enrolled in.

### 1.3 Tenant RLS Isolation
- The analytics API MUST only return data belonging to the authenticated tenant organization.
- No cross-tenant data leaks are permitted.

## 2. Interface Contracts

### 2.1 API Endpoint Definition
- `GET /api/unsubscribes/analytics`
  - Headers: `Authorization: Bearer <tenant-token>`
  - Response: `200 OK`
    ```json
    {
      "success": true,
      "data": {
        "totalUnsubscribes": 5,
        "reasonBreakdown": [
          { "reason": "frequency", "count": 3, "percentage": "60.0%" },
          { "reason": "relevance", "count": 1, "percentage": "20.0%" },
          { "reason": "not_requested", "count": 1, "percentage": "20.0%" },
          { "reason": "other", "count": 0, "percentage": "0.0%" }
        ],
        "sequenceBreakdown": [
          {
            "sequenceId": "seq-uuid-1",
            "sequenceName": "Acme Welcome Drip",
            "count": 4,
            "percentage": "80.0%"
          },
          {
            "sequenceId": "seq-uuid-2",
            "sequenceName": "Outbound Cold Sequence",
            "count": 1,
            "percentage": "20.0%"
          }
        ]
      }
    }
    ```
