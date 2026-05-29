# Specification: Email & Calendar Synchronization API - Design

## 1. Database Schema Additions

We will add two new tables `email_calendar_sync_settings` and `email_calendar_sync_runs` to `packages/db/src/schema.ts` to manage sync configurations and track run histories.

### Table: `email_calendar_sync_settings`
```typescript
export const emailCalendarSyncSettings = pgTable("email_calendar_sync_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // "google" | "outlook" | "mock"
  isActive: boolean("is_active").notNull().default(true),
  syncEmails: boolean("sync_emails").notNull().default(true),
  syncCalendar: boolean("sync_calendar").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Table: `email_calendar_sync_runs`
```typescript
export const emailCalendarSyncRuns = pgTable("email_calendar_sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  settingsId: uuid("settings_id")
    .notNull()
    .references(() => emailCalendarSyncSettings.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("success"), // "success" | "failed"
  emailsSyncedCount: integer("emails_synced_count").notNull().default(0),
  eventsSyncedCount: integer("events_synced_count").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});
```

## 2. In-Memory Store Integration (`packages/db`)
We will register the new tables in `packages/db/src/index.ts` to support local verification, testing, and mock client operations:
- Add `emailCalendarSyncSettings` and `emailCalendarSyncRuns` arrays in `store`.
- Implement `findMany`, `findOne`, `insert`, `update`, `delete`, and special queries (e.g. `findByUser`) in the `dbStore` client wrapper.

## 3. Core Synchronization Engine (`packages/core`)
We will add core interfaces and a pure simulation function `syncExternalItems` in `packages/core/src/index.ts`.

### Core Types
```typescript
export interface ExternalEmail {
  externalId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

export interface ExternalCalendarEvent {
  externalId: string;
  title: string;
  description: string;
  attendees: string[]; // List of attendee email addresses
  eventDate: Date;
}

export interface SyncSimulationInput {
  settings: {
    syncEmails: boolean;
    syncCalendar: boolean;
  };
  externalEmails: ExternalEmail[];
  externalCalendarEvents: ExternalCalendarEvent[];
  existingLeads: { id: string; email: string | null }[];
  existingContacts: { id: string; email: string | null }[];
  existingActivityExternalIds: string[]; // Avoid importing duplicates
}
```

### Pure Sync Calculation
```typescript
export function syncExternalItems(input: SyncSimulationInput) {
  const syncedEmails: {
    externalId: string;
    subject: string;
    body: string;
    receivedAt: Date;
    targetType: "Lead" | "Contact";
    targetId: string;
  }[] = [];

  const syncedEvents: {
    externalId: string;
    title: string;
    description: string;
    eventDate: Date;
    targetType: "Lead" | "Contact";
    targetId: string;
  }[] = [];

  // Match and sync emails
  if (input.settings.syncEmails) {
    for (const email of input.externalEmails) {
      if (input.existingActivityExternalIds.includes(email.externalId)) continue;

      // Check contacts first
      const contact = input.existingContacts.find(
        (c) =>
          c.email?.toLowerCase() === email.sender.toLowerCase() ||
          c.email?.toLowerCase() === email.recipient.toLowerCase()
      );
      if (contact) {
        syncedEmails.push({
          externalId: email.externalId,
          subject: email.subject,
          body: email.body,
          receivedAt: email.receivedAt,
          targetType: "Contact",
          targetId: contact.id,
        });
        continue;
      }

      // Check leads next
      const lead = input.existingLeads.find(
        (l) =>
          l.email?.toLowerCase() === email.sender.toLowerCase() ||
          l.email?.toLowerCase() === email.recipient.toLowerCase()
      );
      if (lead) {
        syncedEmails.push({
          externalId: email.externalId,
          subject: email.subject,
          body: email.body,
          receivedAt: email.receivedAt,
          targetType: "Lead",
          targetId: lead.id,
        });
      }
    }
  }

  // Match and sync calendar events
  if (input.settings.syncCalendar) {
    for (const event of input.externalCalendarEvents) {
      if (input.existingActivityExternalIds.includes(event.externalId)) continue;

      let matched = false;
      for (const attendee of event.attendees) {
        const contact = input.existingContacts.find(
          (c) => c.email?.toLowerCase() === attendee.toLowerCase()
        );
        if (contact) {
          syncedEvents.push({
            externalId: event.externalId,
            title: event.title,
            description: event.description,
            eventDate: event.eventDate,
            targetType: "Contact",
            targetId: contact.id,
          });
          matched = true;
          break; // Avoid linking the same event multiple times if there are multiple attendees
        }
      }

      if (matched) continue;

      for (const attendee of event.attendees) {
        const lead = input.existingLeads.find(
          (l) => l.email?.toLowerCase() === attendee.toLowerCase()
        );
        if (lead) {
          syncedEvents.push({
            externalId: event.externalId,
            title: event.title,
            description: event.description,
            eventDate: event.eventDate,
            targetType: "Lead",
            targetId: lead.id,
          });
          break;
        }
      }
    }
  }

  return { syncedEmails, syncedEvents };
}
```

## 4. API Endpoint Integration (`apps/api`)
Register endpoints protected by `tenantAuth`:
- **`GET /api/productivity/sync/settings`**: Retrieves settings for the active user (`c.get("tenant").userId`).
- **`POST /api/productivity/sync/settings`**: Upserts `isActive`, `provider`, `syncEmails`, `syncCalendar` preferences.
- **`POST /api/productivity/sync/trigger`**:
  1. Fetches sync settings.
  2. Queries active tenant leads, contacts, and existing activities.
  3. Executes `syncExternalItems` with mock external items.
  4. Inserts new `activities` and `activity_links` into the DB.
  5. Inserts a new record in `emailCalendarSyncRuns` logging counts and timestamps.
- **`GET /api/productivity/sync/runs`**: Queries all runs logged for the settings under active tenant.
