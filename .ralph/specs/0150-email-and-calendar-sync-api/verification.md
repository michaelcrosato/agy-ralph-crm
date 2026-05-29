# Specification: Email & Calendar Synchronization API - Verification

## 1. Concrete Verification Commands

Execute the standard verification gates to ensure workspace linkages, types, and test suites are 100% stable:

```bash
# 1. Typecheck and lint validation
pnpm typecheck
pnpm lint

# 2. Execute unit & integration test suite
pnpm test:integration --run packages/testing/src/email-calendar-sync.test.ts

# 3. Comprehensive verify gate
pnpm verify
```

## 2. Test Cases to Assert in Integration Suite
- **Sync Settings CRUD**:
  - Insert new settings for a user.
  - Update settings, changing sync flags and provider.
  - Verify settings belong strictly to the user's active tenant (`orgId`).
- **RLS Boundary Assertion**:
  - Assert that Org A's user cannot trigger sync or view settings for Org B's user.
  - Assert that DB insertions for another tenant fail automatically with a tenant context mismatch error.
- **Sync Execution and Linking**:
  - Run sync with mock emails and calendar events.
  - Assert emails from/to registered Leads/Contacts are imported as `activities` (type `"email"`) and mapped via `activity_links`.
  - Assert calendar events with matching attendees are imported as `activities` (type `"task"`) and mapped via `activity_links`.
  - Assert that items with `externalId` already imported are skipped on subsequent sync trigger runs.
