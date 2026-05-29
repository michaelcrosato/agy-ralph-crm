# Specification: Marketing Sequence Conversion Goals & Attribution Engine - Requirements

## 1. Functional Requirements

### 1.1 Goal Rule Storage & Definition
- The CRM must support defining a success Goal for any marketing sequence.
- A goal configuration must include:
  - `id`: Unique identifier (UUID).
  - `orgId`: Tenant identifier for strict RLS.
  - `sequenceId`: The sequence this goal belongs to.
  - `goalType`: The trigger metric for success, supporting `"lead_status_equals"` or `"opportunity_created"`.
  - `targetValue`: The target string value (e.g., `"Qualified"` for lead status) used to evaluate success.
  - `isActive`: Boolean flag indicating if the goal is active (1 = active, 0 = inactive).

### 1.2 Dynamic Conversion & Attribution Engine
- When the sequence execution loop processes active memberships, or when a lead status updates / opportunity is created:
  - The engine must check if any active goals exist for the membership's sequence.
  - If a goal is `"lead_status_equals"`:
    - The engine must load the associated lead.
    - If the lead's `status` matches the `targetValue`, the goal is achieved.
  - If a goal is `"opportunity_created"`:
    - The engine must load opportunities linked to the lead or contact.
    - If at least one opportunity exists, the goal is achieved.
- Upon goal achievement:
  - Update `marketing_sequence_memberships.status` to `"converted"`.
  - Create a new log record in `marketing_sequence_conversions` capturing `membershipId`, `orgId`, `sequenceId`, `goalId`, and `attributedRevenue`.
  - If `"opportunity_created"` is the goal type, the `attributedRevenue` must equal the sum of the opportunity `amount` values (parsed as decimals).
  - Log an audit trail entry for the membership status transition with action `"goal_conversion"`.

### 1.3 Tenant RLS Isolation
- Goal definitions, conversion events, and revenue attribution details must be strictly isolated by `org_id`.
- Tenant A must never be able to read, update, or trigger conversion evaluations for Tenant B's sequences, goals, or memberships.

---

## 2. API Endpoints

### 2.1 GET `/api/sequences/:id/goals`
- Returns all configured conversion goals for a specific sequence.
- Isolated under tenant context.

### 2.2 POST `/api/sequences/:id/goals`
- Creates or updates the conversion goal configuration for a sequence.
- Payload:
  ```json
  {
    "goalType": "lead_status_equals",
    "targetValue": "Qualified"
  }
  ```

### 2.3 GET `/api/sequences/:id/conversion-analytics`
- Returns aggregated sequence-level conversion analytics:
  ```json
  {
    "success": true,
    "data": {
      "sequenceId": "uuid-here",
      "totalEnrolled": 150,
      "convertedCount": 30,
      "conversionRate": "20.00%",
      "totalAttributedRevenue": "75000.00",
      "averageDaysToConvert": 4.5
    }
  }
  ```
