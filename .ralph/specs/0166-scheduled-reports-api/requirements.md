# Task 0166: Scheduled Reports & Email Delivery Engine - Requirements

## Functional Requirements

1. **Scheduled Report Management**:
   - Create, list, retrieve, and delete scheduled reports.
   - Each schedule must reference an existing saved `Report` record.
   - Accept parameters: `recipientEmail: string`, `frequency: "daily" | "weekly" | "monthly"`, and `isActive: number (0|1)`.
   - Automatically determine `nextRunAt` based on current time and selected frequency.

2. **Scheduled Execution Engine**:
   - Provide a programmatic method `runPendingScheduledReports(dbStore: any, store: any, orgId: string): Promise<number>` that fetches and executes all active scheduled reports where `nextRunAt` is less than or equal to the current system time.
   - Running a report must fetch the target records under active tenant row-level security and aggregate them using the existing `runReport` reporting package utility.
   - Update `nextRunAt` dynamically to the next scheduled interval after execution.

3. **Execution History Logging**:
   - Record every executed run in `scheduled_report_runs` with columns: `id`, `orgId`, `scheduledReportId`, `status: "success" | "failed"`, `errorMessage: string | null`, `runAt`.
   - Ensure errors during execution are gracefully caught, logged as a failure in `scheduled_report_runs`, and do not block subsequent schedule runs.

4. **Notifications & Webhook Integration**:
   - Upon successful execution of a scheduled report, simulate sending an email log activity or dispatching an outbound webhook event (`report.delivered`) containing the compiled report run results.

5. **Multi-Tenant / RLS Enforcement**:
   - All management operations (listing, creating, deleting schedules) and execution processing must run under strict active tenant context.
   - It must be impossible for Org A to schedule, view, edit, or access scheduled reports or run history belonging to Org B.

6. **API Endpoints**:
   - `POST /api/reports/scheduled`: Create a new scheduled report.
   - `GET /api/reports/scheduled`: List all scheduled reports for the active tenant.
   - `DELETE /api/reports/scheduled/:id`: Delete a scheduled report.
   - `POST /api/reports/scheduled/run-pending`: Trigger execution of all pending scheduled reports for the active tenant, returning the count of processed reports.
