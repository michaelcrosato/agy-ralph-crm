# Specification: Marketing Sequence Recipient Time-Zone Smart Delivery Engine - Requirements

## 1. Functional Requirements

### 1.1 Timezone Retrieval & Validation
- The execution engine MUST retrieve the recipient's timezone from their profile custom metadata field `custom.timezone` (e.g., `lead.custom.timezone` or `contact.custom.timezone`).
- Recognized timezones MUST be valid IANA timezone names (e.g., `"America/New_York"`, `"Europe/London"`, `"Asia/Tokyo"`).
- If the `timezone` field is empty, null, or not a valid recognized timezone, the engine MUST fallback to `"UTC"`.

### 1.2 Timezone-Aware Sending Window Checks
- All sequence constraint checks (sending days of the week, and hours window start/end) MUST be evaluated based on the recipient's local clock rather than the system/UTC clock.
- If a sequence specifies a `sendingWindowStart = "09:00"` and `sendingWindowEnd = "17:00"`, sending is only allowed if the recipient's local hour/minute falls inside `[09:00, 17:00)`.
- If a sequence specifies allowed sending days (e.g., `[1, 2, 3, 4, 5]` for weekdays), sending is only allowed if it is currently a weekday in the recipient's local timezone.

### 1.3 Schedule Deferral & Alignment
- If `executePendingSequenceSteps` runs and finds a membership whose scheduled `nextExecutionAt` is in the past, but the recipient's local time is *outside* the valid sequence sending window:
  - The membership MUST NOT be processed/executed.
  - The membership's `nextExecutionAt` MUST be deferred to the next valid start time in the recipient's local timezone.
  - An audit log entry MUST be inserted with action `"membership_schedule_deferred"` capturing the schedule update.
- When a step is executed successfully, the next execution time (computed by adding the step's `delayDays` or evaluation window) MUST be aligned to the start of the sending window in the recipient's local timezone.

### 1.4 API Requirements
- No new REST endpoints are strictly required, but the existing Hono REST API for creating leads/contacts (`POST /api/leads` and `POST /api/contacts`) MUST accept a `custom.timezone` field in their payloads.
- The lead conversion API (`POST /api/leads/:id/convert`) MUST preserve the `timezone` custom field when mapping a lead to a contact.

---

## 2. Row-Level Security (RLS) & Tenancy Requirements
- All database operations MUST run under the strict tenant context propagated via AsyncLocalStorage.
- Scheduling deferrals or audit logging MUST be fully tenant-isolated; one organization cannot modify, trigger, or view the schedule of memberships belonging to another organization.
