# 034 — Finish legacy TICKET005 — Lead SLA breach email worker

**Phase:** 2 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 011

## Description & Expected Impact
Legacy `tickets/TICKET005.md` is open: implement `checkSlabreaches` worker in `packages/core` that scans Leads with active SLA, generates a `System Notification` activity + email-log entry on breach, idempotent via an `slaAlertSent` flag.

## Definition of Done & Acceptance Criteria
- [ ] `packages/core/src/domain/sla/checkSlaBreaches.ts` exports the worker.
- [ ] Idempotency flag stored in Lead `custom.slaAlertSent: boolean | timestamp`.
- [ ] Generates `activities` row (type=Email) + `email_logs` row (status=mock_sent).
- [ ] RLS-scoped per tenant.
- [ ] Tests in `packages/testing/src/lead-sla-notifications.test.ts` cover breach, no-breach, idempotency, RLS.
- [ ] Legacy ticket updated.

## Implementation Approach
- Pure function returning a list of side-effect descriptors; caller applies them inside `withTenant`. This keeps `packages/core` stateless.

## Test Strategy
- Integration: 4 tests.

## Rollback
Disable feature flag.
