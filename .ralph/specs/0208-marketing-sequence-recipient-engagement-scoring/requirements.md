# Specification: Marketing Sequence Recipient Engagement Scoring - Requirements

## 1. Functional Requirements

### 1.1 Engagement Scoring Rules & Weights
The system MUST compute a composite `engagementScore` for each sequence membership using the following point values based on their tracking events:
1. **Email Open Events**: `+1` point per recorded open.
2. **Email Click Events**: `+3` points per recorded click.
3. **Email Reply Events**: `+10` points per recorded reply.
4. **Email Read Time Events**: Classified according to duration:
   - `"glanced"` (< 2s): `0` points.
   - `"skimmed"` (2s-8s, inclusive): `+2` points.
   - `"read"` (>= 8s): `+5` points.
5. **Email Delivery Failure / Bounce / Complaint**:
   - `"bounce"` (hard bounce): `-5` points.
   - `"complaint"` (spam complaint): `-10` points.
6. **Membership Unsubscribed**: If a membership's status is updated to `"unsubscribed"`, the score is docked by `-15` points (to a minimum of `0` if needed, or keeping it negative depending on implementation. Let's specify that the score can go negative but if they unsubscribed, the final score must subtract an extra 15 points).

The composite engagement score is the cumulative sum of all these points.

### 1.2 Automated Real-Time Recalculation
- The system MUST automatically update the `engagementScore` on the `marketingSequenceMemberships` record in real-time whenever one of the following public tracking endpoints receives a valid event:
  - `POST /api/public/emails/track/open/:token`
  - `POST /api/public/emails/track/click/:token`
  - `POST /api/public/emails/track/reply/:token`
  - `POST /api/public/emails/track/bounce/:token` (or general bounce delivery route)
  - `POST /api/public/emails/track/read-time/:token`
  - `POST /api/public/emails/unsubscribe/:token` (or unsubscribe route that transitions member status)

### 1.3 Tenant RLS Isolation
- The scoring API and all query logic MUST enforce strict row-level security (RLS) isolation.
- Tenant A must never be able to view, query, or trigger recalculation of engagement scores belonging to Tenant B.
- Tracking endpoints (which are public) MUST correctly locate records under the correct organization context and mutate them securely without leaking any data or violating isolation boundaries.

## 2. Interface Contracts

### 2.1 API Endpoint Definitions

#### GET /api/sequences/:id/engagement-scores
- Secure route with `tenantAuth`.
- Path Parameter: `id` (UUID of the marketing sequence).
- Response: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "membershipId": "membership-uuid-1",
        "recordType": "lead",
        "recordId": "lead-uuid-1",
        "recordName": "Alpha Corp Lead",
        "email": "lead1@example.com",
        "status": "active",
        "engagementScore": 18
      }
    ]
  }
  ```

#### POST /api/sequences/members/:id/recalculate-score
- Secure route with `tenantAuth`.
- Path Parameter: `id` (UUID of the sequence membership).
- Response: `200 OK`
  ```json
  {
    "success": true,
    "message": "Engagement score recalculated successfully",
    "engagementScore": 18
  }
  ```
