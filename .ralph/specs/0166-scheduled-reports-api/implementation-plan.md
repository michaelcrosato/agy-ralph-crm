# Task 0166: Scheduled Reports & Email Delivery Engine - Implementation Plan

## Steps to Execute

1. **Schema Expansion**:
   - Add `scheduledReports` and `scheduledReportRuns` to `packages/db/src/schema.ts`.
   - Re-export them appropriately.

2. **Store Setup**:
   - Add TypeScript interfaces `DBScheduledReport` and `DBScheduledReportRun` in `packages/db/src/index.ts`.
   - Scaffold their array initialization in the global `store`.
   - Implement active-tenant RLS handlers under `dbStore.scheduledReports` and `dbStore.scheduledReportRuns`.

3. **Core Functionality**:
   - Write `calculateNextRunDate` and `runPendingScheduledReports` inside `packages/core/src/index.ts`.
   - Export both methods.

4. **API Endpoints**:
   - Add `GET /api/reports/scheduled`, `POST /api/reports/scheduled`, `DELETE /api/reports/scheduled/:id`, and `POST /api/reports/scheduled/run-pending` inside `apps/api/src/index.ts`.
   - Ensure all endpoints are protected by `tenantAuth` middleware.

5. **Integration Tests**:
   - Add comprehensive tests in `packages/testing/src/scheduled-reports.test.ts` to assert that:
     - Schedules can be added, listed, and deleted under RLS.
     - Org A cannot access Org B's schedules.
     - Pending schedules are processed correctly, run history is populated, and webhooks are triggered.
     - Failures inside a scheduled report run are handled and logged without crashing the loop.
