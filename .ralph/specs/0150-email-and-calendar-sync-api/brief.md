# Specification: Email & Calendar Synchronization API - Brief

## 1. Functional Objective
To boost sales productivity, a modern commercial CRM must automatically sync communication (emails) and schedule items (calendar events) from external providers (e.g. Google Workspace, Microsoft Outlook) directly to relevant Lead, Account, and Contact records.

This feature introduces the **Email & Calendar Synchronization API**. The system will:
1. Allow tenants to configure sync settings per user, specifying external provider, status (active/inactive), and whether to sync emails, calendar events, or both.
2. Track synchronization run histories (status, counts of synced items, execution window, errors).
3. Provide a simulation engine in `packages/core` that resolves mock incoming emails/events against existing CRM Contact and Lead records, automatically creating corresponding CRM activities (type `"email"` or `"task"`) and establishing standard activity link associations.
4. Expose REST endpoints to manage synchronization settings, trigger synchronization runs, and fetch sync history under strict multi-tenant Row-Level Security (RLS) isolation.

## 2. Technical Scope
- **Database Schema**:
  - Add `email_calendar_sync_settings` and `email_calendar_sync_runs` to `packages/db/src/schema.ts` and update the in-memory store in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `syncExternalItems` in `packages/core/src/index.ts` to simulate syncing external mailbox and calendar items, matching recipient/sender email addresses with active CRM Leads/Contacts, and producing activity records.
- **REST Endpoints**:
  - `GET /api/productivity/sync/settings` - Retrieves sync settings for the authenticated user.
  - `POST /api/productivity/sync/settings` - Creates or updates sync settings.
  - `POST /api/productivity/sync/trigger` - Triggers a sync run, executing the simulation engine, creating activities/links, and logging the run.
  - `GET /api/productivity/sync/runs` - Queries the sync run history for the tenant.
- **Tenant RLS & Security**:
  - Ensure all sync configurations, runs, and created activities run strictly within the active tenant's context. A tenant must never see or trigger sync runs for another organization's settings.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/email-calendar-sync.test.ts` validating setting management, correct simulation activity linking, and multi-tenant RLS isolation.
