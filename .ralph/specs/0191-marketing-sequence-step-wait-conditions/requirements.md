# Specification: Marketing Sequence Step Wait Conditions - Requirements

## 1. Functional Requirements

### 1.1 Step Wait Condition Field
- Each sequence step (`marketingSequenceSteps` table) MUST support an optional JSONB field named `waitCondition`.
- The `waitCondition` payload schema MUST support:
  - `waitType`: A string with value `"day_of_week"` or `"duration"`.
  - `daysOfWeek`: An array of numbers (0-6, where 0 = Sunday, 1 = Monday, etc.) required when `waitType` is `"day_of_week"`.
  - `timeOfDay`: An optional string in `"HH:mm"` format (e.g. `"09:00"`) defining the target execution time on that day.

### 1.2 Execution Date Calculation
- When a sequence step finishes execution, the engine MUST calculate the execution time of the *next* step.
- If the next step has a `waitCondition` of type `"day_of_week"`:
  - The engine MUST apply any static `delayDays` first (cooldown duration).
  - From that point, it MUST find the next occurrence of one of the specified `daysOfWeek`.
  - If `timeOfDay` is provided, the execution time MUST be set to that specific time of day (in the recipient's timezone if timezone smart delivery is active, or the system default timezone).
- If the next step has no wait condition or wait type `"duration"`, the engine MUST fall back to adding `delayDays` to the current execution time.

### 1.3 REST API Serialization
- Step creation (`POST /api/sequences/:id/steps`) and step update routes MUST accept, serialize, and validate the new `waitCondition` parameter.
- Invalid wait conditions (e.g. invalid days of week or malformed times) MUST be caught and returned as a `400 Bad Request` response.

---

## 2. Row-Level Security (RLS) & Tenancy Requirements
- All database operations for wait condition configurations, step scheduling, and execution audits MUST be strictly isolated under active tenant row-level security.
- One tenant organization MUST NOT be able to view, query, modify, or trigger step wait conditions belonging to another organization.
