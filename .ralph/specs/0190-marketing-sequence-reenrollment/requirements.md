# Specification: Marketing Sequence Campaign Automated Re-Enrollment & Frequency Capping Controls - Requirements

## 1. Functional Requirements

### 1.1 Active Enrollment Prevention
- The enrollment engine MUST block any attempt to enroll a Lead or Contact into a sequence if they currently have an active membership (status `"active"` or `"snoozed"`).
- Thrown validation errors MUST clearly state: `"Recipient is already actively enrolled in this sequence"`.

### 1.2 Re-Enrollment Controls
- Each sequence MUST support a boolean flag `allowReenrollment` (defaulting to `false`).
- If `allowReenrollment` is `false`, the engine MUST block enrollment if the recipient has any prior memberships in the sequence (e.g., status `"completed"`, `"suppressed"`, `"snoozed"`, or `"active"`).
- Thrown validation errors MUST clearly state: `"Re-enrollment is not allowed for this sequence"`.

### 1.3 Frequency Capping cooldown
- Each sequence MUST support an optional integer configuration `reenrollmentMinDays`.
- If `allowReenrollment` is `true` and `reenrollmentMinDays` is configured (greater than `0`):
  - The engine MUST check the time elapsed since the recipient's last active membership record was updated or created.
  - If the elapsed time is less than `reenrollmentMinDays`, the enrollment MUST be blocked.
  - Thrown validation errors MUST clearly state: `"Frequency cap breached: recipient was recently enrolled and must wait at least [minDays] days before re-enrolling"`.

### 1.4 REST API & Serializer
- Sequence management endpoints (`POST /api/sequences` and update PUT/PATCH routes) MUST support specifying `allowReenrollment` and `reenrollmentMinDays`.
- The sequence enrollment endpoint (`POST /api/sequences/:id/enroll`) MUST capture these validation errors and return `400 Bad Request` with `{ success: false, error: "[ErrorMessage]" }` instead of returning a 500 server crash error.

---

## 2. Row-Level Security (RLS) & Tenancy Requirements
- All validation, membership history queries, and RLS checks MUST execute within the active organization context (`AsyncLocalStorage`).
- One tenant organization MUST NOT be able to view, query, or affect the sequence memberships or re-enrollment constraints of another tenant organization.
- Tenancy validation checks MUST throw an absolute database execution failure if a tenant mismatch occurs.
