# 025 — Zod-validate JSONB columns at insert/update

**Phase:** 1 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 013

## Description & Expected Impact
Schema declares wide JSONB columns (`opportunities.custom`, `accounts.custom`, `leads.custom`, `tickets.custom`) with no runtime validation. Garbage in = silent corruption + downstream query failures. Add Zod schemas per tenant metadata config; enforce at the store layer.

## Definition of Done & Acceptance Criteria
- [ ] `packages/db/src/_jsonb.ts` exports `validateCustomFields(tenantId, entity, payload)` consulting tenant's `fieldDefinitions` (from `packages/metadata`).
- [ ] Every store insert/update of an aggregate with a `custom` JSONB column calls this validator.
- [ ] Invalid payloads → typed error `JsonbValidationError` with field-level details.
- [ ] New test `packages/testing/src/jsonb-validation.test.ts` covering valid + invalid payloads for 3 aggregates.
- [ ] 403 + new tests pass.

## Implementation Approach
- Reuse Zod schemas built dynamically from `fieldDefinitions` metadata.
- Cache compiled Zod schemas per `(tenantId, entity)` to avoid recomputing on every write.

## Test Strategy
- New: 6 new tests (2 per aggregate × 3 aggregates).
- Regression: 403/403.

## Rollback
Bypass validator via env flag `JSONB_VALIDATION=off`.
