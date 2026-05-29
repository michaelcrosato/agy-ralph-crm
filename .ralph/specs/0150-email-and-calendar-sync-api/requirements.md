# Specification: Email & Calendar Synchronization API - Requirements

## 1. Functional Requirements

### 1.1 Synchronization Settings Management
- **REQ-1.1.1**: The system must allow users to configure their sync preferences.
- **REQ-1.1.2**: Sync settings must include:
  - `provider`: String representing the external provider (e.g., `"google"`, `"outlook"`, `"mock"`).
  - `isActive`: Boolean flag indicating if synchronization is currently active.
  - `syncEmails`: Boolean flag indicating if emails should be synchronized.
  - `syncCalendar`: Boolean flag indicating if calendar events should be synchronized.
- **REQ-1.1.3**: A user can have at most one active sync setting at a time.
- **REQ-1.1.4**: All updates to settings must immediately be stored securely.

### 1.2 Synchronization Simulation & Execution
- **REQ-1.2.1**: The sync engine must simulate retrieving a list of external emails and calendar events.
- **REQ-1.2.2**: For each synced email, the system must check the sender and recipient addresses:
  - If a sender/recipient matches the email of an existing Contact or Lead in the current tenant, the email must be imported into CRM activities.
  - The imported email must be saved as a CRM activity of type `"email"`.
  - An `activity_link` must be created linking the activity to the matched Contact or Lead.
- **REQ-1.2.3**: For each synced calendar event:
  - The engine must check attendees' email addresses.
  - If any attendee matches an existing Contact or Lead, a CRM activity of type `"task"` (representing a meeting/event) must be created.
  - An `activity_link` must be created linking the event activity to the matched Contact or Lead.
- **REQ-1.2.4**: Synced items must not be duplicated. Each simulated external item must have a unique identifier (`externalId`), and subsequent sync runs must ignore items that have already been imported.

### 1.3 Audit & History Logging
- **REQ-1.3.1**: Each sync run must log a detailed sync run history.
- **REQ-1.3.2**: A sync run record must store:
  - The start time and end time of the execution.
  - The final status (`"success"` or `"failed"`).
  - The count of successfully imported emails and calendar events.
  - Any error messages generated during execution.

## 2. Security & RLS Requirements
- **REQ-2.1**: **Multi-Tenant RLS Isolation**: All sync settings, run histories, created activities, and activity links must belong to the authenticated user's organization (`orgId`).
- **REQ-2.2**: A user must never be able to read, update, delete, or trigger synchronization for another tenant's synchronization settings.
- **REQ-2.3**: The sync engine must enforce RLS at the store level during the simulation and import process.

## 3. API Route Requirements
- **REQ-3.1**: `GET /api/productivity/sync/settings`
  - Returns the active tenant's sync settings for the authenticated user.
- **REQ-3.2**: `POST /api/productivity/sync/settings`
  - Upserts sync settings for the authenticated user under active tenant isolation.
- **REQ-3.3**: `POST /api/productivity/sync/trigger`
  - Executes a sync run simulation using mock external items.
  - Automatically imports matching items as CRM activities and creates links.
  - Creates and returns the `email_calendar_sync_runs` result log.
- **REQ-3.4**: `GET /api/productivity/sync/runs`
  - Returns a list of sync runs executed for the active tenant's settings.
