# Task 0166: Scheduled Reports & Email Delivery Engine - Design

## Database Schema Extensions (`packages/db/src/schema.ts`)

We will add two new Drizzle pgTable definitions:

```typescript
export const scheduledReports = pgTable("scheduled_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email").notNull(),
  frequency: text("frequency").notNull(), // "daily" | "weekly" | "monthly"
  nextRunAt: timestamp("next_run_at").notNull().defaultNow(),
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scheduledReportRuns = pgTable("scheduled_report_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  scheduledReportId: uuid("scheduled_report_id")
    .notNull()
    .references(() => scheduledReports.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("success"), // "success" | "failed"
  errorMessage: text("error_message"),
  runAt: timestamp("run_at").notNull().defaultNow(),
});
```

## TypeScript & Store Contracts (`packages/db/src/index.ts`)

Expose these interfaces and incorporate them into the in-memory mock store:

```typescript
export interface DBScheduledReport {
  id: string;
  orgId: string;
  reportId: string;
  recipientEmail: string;
  frequency: "daily" | "weekly" | "monthly";
  nextRunAt: Date;
  isActive: number;
  createdAt: Date;
}

export interface DBScheduledReportRun {
  id: string;
  orgId: string;
  scheduledReportId: string;
  status: "success" | "failed";
  errorMessage: string | null;
  runAt: Date;
}
```

Add these corresponding arrays inside `store` and register standard operations (`findMany`, `findOne`, `insert`, `update`, `delete`) in `dbStore`.

## Core Logic & Calculation Utility (`packages/core/src/index.ts`)

Implement:
1. `calculateNextRunDate(fromDate: Date, frequency: "daily" | "weekly" | "monthly"): Date` - standard date utility.
2. `runPendingScheduledReports(dbStore: any, store: any, orgId: string): Promise<number>`:
   - Loops through pending active scheduled reports.
   - For each report, executes its query by fetching target records (e.g. leads, accounts) and calling `runReport`.
   - Records the run in `scheduledReportRuns`.
   - Updates `nextRunAt`.
   - Dispatches a webhook `report.delivered` event containing the compiled results.
