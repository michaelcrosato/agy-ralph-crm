# TICKET005: Lead SLA Breaches Email Notification Service

## Details
- **Status**: completed
- **Priority**: Medium
- **Goal**: Build a background worker service that scans active Leads under SLA timers and dispatches email alert logs on breaches under the tenant isolation context.
- **Context**: Guarantees that sales reps are notified immediately when a high-priority Lead is not contacted within the designated SLA target.

---

## Scope

### In Scope
- Implement a worker method `checkSlabreaches` in `packages/core/src/index.ts`.
- Fetch all Leads with active SLA targets.
- Compute the elapsed time and compare it against `sla_targets`.
- Generate and persist a `"System Notification"` activity and a mock outbound email log.
- Wrap all database reads and writes under strict `withTenant(orgId)` contexts.
- Write Vitest tests in `packages/testing/src/lead-sla-notifications.test.ts`.

### Out of Scope
- Direct dependencies on external SMTP email containers (use the existing mock email log store).

---

## Technical Mappings

- **Likely Files**:
  - `packages/core/src/index.ts`
  - `packages/db/src/schema.ts`
  - `packages/testing/src/lead-sla-notifications.test.ts`

---

## Steps to Execute
1. Implement the breach scanner logic inside the sequences/activities engine of `packages/core/src/index.ts`.
2. Generate an activity of type `"Email"` and log a record to `emailLogs` when breach triggers.
3. Secure the query loop to traverse only the current organization's active records.
4. Run `pnpm verify` to confirm compilation.
5. Run targeted tests via `npx vitest run packages/testing/src/lead-sla-notifications.test.ts`.

---

## Acceptance Criteria
- [x] Breached SLA timer triggers a mock email log with correct subject and body personalizations.
- [x] Strict RLS checks prevent tenant B from reading tenant A's breached Leads.
- [x] Non-breached Leads do not trigger alerts.

---

## Commands
```bash
npx vitest run packages/testing/src/lead-sla-notifications.test.ts
pnpm verify
```

---

## Risks & Notes
- **Risk**: Double alerts if the service triggers multiple times on the same breach.
- **Note**: Maintain an `slaAlertSent` flag on the Lead custom metadata.
