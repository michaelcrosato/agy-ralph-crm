# Specification: Marketing Sequence Member Activity Logs & Timeline API - Requirements

## 1. Functional Requirements

### 1.1 Chronological Consolidation Engine
- When fetching activity logs for a sequence membership via `getMarketingSequenceMemberLogs`, the system must query:
  - All `emailTrackers` associated with the sequence membership's `id` (matching `activityId` which maps to membership ID or general tracker tracking records).
  - All matching rows in `emailOpenEvents`, `emailClickEvents`, `emailReplyEvents`, `emailBounceEvents`, and `emailReadTimeEvents` that link to those tracker IDs.
- For each event found, compile a unified `ActivityLogEntry` structure:
  - `id`: Event record ID.
  - `type`: One of `"sent"`, `"open"`, `"click"`, `"reply"`, `"bounce"`, `"complaint"`, `"read_time"`.
  - `timestamp`: Event creation date.
  - `details`: Object containing type-specific metadata (e.g. `clickedUrl` for clicks, `sentiment` and `replyBody` for replies, `deviceType` for opens, `bounceType` for bounces, `readClassification` for read times).
- Sort the aggregated list of entries by `timestamp` in descending order.

### 1.2 Tenancy Context Security
- Querying member activity logs must validate that:
  - The marketing sequence belongs to the active tenant (`orgId`).
  - The membership record belongs to the active tenant (`orgId`).
  - The associated trackers and event rows belong to the active tenant (`orgId`).
- Any attempt to access logs with a mismatched `orgId` (tenant mismatch) must throw a strict database-level RLS isolation error.

### 1.3 REST API endpoint contracts
- Endpoint `GET /api/sequences/:id/members/:memberId/logs`:
  - Must return `404 Not Found` if the sequence or membership record does not exist.
  - Must return `400 Bad Request` if the membership does not belong to the specified sequence.
  - Must return `200 OK` with JSON structure: `{ success: true, data: ActivityLogEntry[] }`.

## 2. Technical & Performance Constraints
- Keep database queries efficient by matching on `trackerId` lists directly.
- The execution budget requires all verification operations and unit/integration tests to run cleanly in under 5 seconds.
- Zero TODOs or placeholders in code blocks.

## 3. Definition of Done
- Implementation compiles cleanly without TypeScript errors.
- Biome check reports 0 linting or formatting problems.
- All integration and unit tests pass with 100% success.
