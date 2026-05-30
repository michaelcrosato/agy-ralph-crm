# 024 — Declare composite + single-column indexes on Drizzle schema

**Phase:** 1 · **Priority:** Critical · **Status:** `[ ] Todo` · **Depends on:** 013

## Description & Expected Impact
This spec is the schema-level counterpart of spec 015. While 015 covers `(tenant_id, created_at)` composites on hot tables, this spec sweeps every column that participates in `WHERE` or `ORDER BY` in the audited route handlers:
- `leads.owner_id`, `leads.email`, `leads.status`
- `opportunities.account_id`, `opportunities.stage`, `opportunities.close_date`
- `tickets.assignee_id`, `tickets.priority`, `tickets.status`
- `marketing_sequence_members.sequence_id`, `…members.lead_id`
- `webhook_outbox.delivered_at` (partial index `WHERE delivered_at IS NULL`)
- `audit_logs.entity_type, entity_id`

## Definition of Done & Acceptance Criteria
- [ ] `packages/db/src/schema.ts` declares `.index()` for each above; composites where co-queried.
- [ ] Partial index for `webhook_outbox` undelivered rows.
- [ ] Migration generated and reviewed for correctness.
- [ ] `EXPLAIN ANALYZE` confirms `Index Scan` for representative queries.

## Implementation Approach
- Read all route handlers from spec 010 → grep for `where(`/`orderBy(` calls → collect unique column references → declare indexes.
- Use Drizzle's `index('idx_…').on(...)` API; prefix names with `idx_<table>_<col(s)>`.

## Test Strategy
- Performance: representative query latencies tracked in `packages/db/perf/baseline.txt`.
- Regression: 403/403.

## Rollback
Drop indexes via migration; queries slow but functional.
