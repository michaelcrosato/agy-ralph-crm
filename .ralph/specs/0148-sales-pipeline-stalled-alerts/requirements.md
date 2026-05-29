# Specification: Sales Pipeline Stalled Alerts API - Requirements

## 1. Functional Requirements

### 1.1 Custom Stage Duration Rules Management
- Tenants must be able to create, read, update, and delete custom stage duration thresholds (in days) for any opportunity stage.
- A rule contains:
  - `stage`: The target opportunity stage (e.g. `"Prospecting"`, `"Proposal"`, etc.).
  - `maxDaysAllowed`: A positive integer representing the maximum duration allowed in that stage before the opportunity is considered stalled.
- Only one rule is allowed per stage for a given tenant. A subsequent `POST` for the same stage should overwrite the existing rule.

### 1.2 Stalled Deal Detection
- The system must identify all active opportunities that are considered "stalled".
- Active opportunities are those whose stage is not `"Closed Won"` and not `"Closed Lost"`.
- If an active opportunity has no recorded `opportunity_stage_history` entry matching its current stage, the duration calculations should fall back to using 0 days elapsed.
- If history records are present, the opportunity's current stage duration is the difference (in days) between the current execution time and the `createdAt` timestamp of the *latest* `opportunity_stage_history` entry where the `toStage` matches the opportunity's current stage.
- An opportunity is flagged as stalled if its current stage duration (in days) exceeds the configured `maxDaysAllowed` for that stage.
- If no custom rule is configured for the stage, the system must apply the following default stage duration thresholds:
  - `"Prospecting"`: 30 days
  - `"Qualification"`: 20 days
  - `"Needs Analysis"`: 14 days
  - `"Value Proposition"`: 14 days
  - `"Id. Decision Makers"`: 10 days
  - `"Perception Analysis"`: 10 days
  - `"Proposal/Price Quote"`: 7 days
  - `"Negotiation/Review"`: 5 days
  - Any other stage: 14 days

### 1.3 Tenant RLS Isolation
- A tenant must only be able to query and configure rules for their own organization.
- Stalled opportunity calculations must only process opportunities and stage history records that belong to the active tenant's organization context.

---

## 2. Non-Functional & API Requirements

### 2.1 REST Endpoints
- `GET /api/opportunities/stalled`
  - Returns HTTP 200 on success.
  - Response format:
    ```json
    {
      "success": true,
      "data": [
        {
          "opportunityId": "string (UUID)",
          "opportunityName": "string",
          "currentStage": "string",
          "elapsedDays": 12,
          "maxDaysAllowed": 7,
          "amount": "string | null"
        }
      ]
    }
    ```
- `GET /api/opportunities/stalled/rules`
  - Returns all stage duration rules defined by the active tenant.
  - Response format:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "string (UUID)",
          "stage": "string",
          "maxDaysAllowed": 10,
          "createdAt": "string (ISO)"
        }
      ]
    }
    ```
- `POST /api/opportunities/stalled/rules`
  - Body payload:
    ```json
    {
      "stage": "Proposal",
      "maxDaysAllowed": 10
    }
    ```
  - Creates or updates the stage duration rule.
  - Validates that `maxDaysAllowed` is a positive integer > 0.
  - Returns the created/updated rule on success.

### 2.2 Security Gateways
- All endpoints must require a valid authorization header containing a JWT session token.
- Returns HTTP 401 Unauthorized if the token is missing or invalid.
