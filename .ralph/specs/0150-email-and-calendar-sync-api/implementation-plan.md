# Specification: Email & Calendar Synchronization API - Implementation Plan

## Step-by-Step Code Generation Sequence

### Phase 1: Database & Memory Store Update
1. **Modify `packages/db/src/schema.ts`**:
   - Define `emailCalendarSyncSettings` and `emailCalendarSyncRuns` schemas.
   - Export both schemas.
2. **Modify `packages/db/src/index.ts`**:
   - Add types `DBEmailCalendarSyncSettings` and `DBEmailCalendarSyncRun`.
   - Update `store` with arrays `emailCalendarSyncSettings` and `emailCalendarSyncRuns`.
   - Update `dbStore` with find, findOne, insert, update, delete methods for both tables under strict `getActiveOrgId` RLS tenant context.

### Phase 2: Core Domain Logic
1. **Modify `packages/core/src/index.ts`**:
   - Define input interfaces (`ExternalEmail`, `ExternalCalendarEvent`, `SyncSimulationInput`).
   - Implement and export `syncExternalItems` pure function matching sender/recipient/attendees with Contacts/Leads and returning synced emails/events to import.

### Phase 3: REST API Integration
1. **Modify `apps/api/src/index.ts`**:
   - Import core sync functions and db tables.
   - Define Zod schemas for input validation on sync settings and trigger.
   - Implement the following routes:
     - `GET /api/productivity/sync/settings`
     - `POST /api/productivity/sync/settings`
     - `POST /api/productivity/sync/trigger`
     - `GET /api/productivity/sync/runs`

### Phase 4: Integration Tests
1. **Create `packages/testing/src/email-calendar-sync.test.ts`**:
   - Write comprehensive tests asserting sync settings CRUD, successful synchronization run of emails and calendar events linking to Leads/Contacts under active tenant context, RLS tenant isolation enforcement, and duplicate sync item prevention.

### Phase 5: Verification & Verification Gate
1. **Run local verification**:
   - Run `pnpm verify` to check compilation, formatting, and linting.
   - If any errors exist, resolve immediately.
