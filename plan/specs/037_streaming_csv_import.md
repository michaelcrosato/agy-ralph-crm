# 037 — Streaming CSV import/export (Node streams, 10M-row safe)

**Phase:** 2 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 013

## Description & Expected Impact
`packages/core/src/index.ts` has `parseCSV` + `processCSVImport` but it buffers the whole file in memory. At 10M rows this OOMs. Rebuild on Node streams + Postgres COPY for ingest and `pg-copy-streams` for export. Audit tests already cover `csv-import.test.ts`; keep them passing.

## Definition of Done & Acceptance Criteria
- [ ] `packages/core/src/domain/csv/import.ts` uses `node:stream/promises` pipeline with `csv-parse`.
- [ ] Postgres ingest uses `COPY ... FROM STDIN` via `pg-copy-streams` (PG backend only; mock backend uses existing flow).
- [ ] Export endpoint streams response (chunked transfer); no buffering.
- [ ] Memory profile under load: < 200MB for a 10M-row CSV import (manual test, not gated).
- [ ] Existing `csv-import.test.ts` continues to pass; new test verifies streaming behavior.

## Implementation Approach
- New: `csv-parse`, `pg-copy-streams` deps.
- Maintain backward-compat shape of `processCSVImport` return value.

## Test Strategy
- Regression: existing tests pass.
- New: 1 streaming smoke test (1K-row CSV) that asserts back-pressure works.

## Rollback
Revert to buffered impl.
