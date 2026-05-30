# 015 — Composite `(tenant_id, …)` indexes on hot tables

**Phase:** 1 · **Priority:** Critical · **Status:** `[ ] Todo` · **Depends on:** 013

## Description & Expected Impact
2026 research consistently flags missing composite indexes as the **#1 performance killer** in RLS multi-tenant SaaS. Without `tenant_id` as the leading column, RLS adds 2 orders of magnitude latency. Retrofitting at 10M rows is painful — bake it in from day one of the PG layer.

## Definition of Done & Acceptance Criteria
- [ ] Drizzle schema declares composite indexes via `index().on(table.tenantId, table.createdAt)` for every high-volume table:
  - `leads`, `accounts`, `contacts`, `opportunities`, `activities`, `tickets`, `email_logs`, `webhook_outbox`, `audit_logs`, `marketing_sequence_members`, `marketing_sequence_steps`.
- [ ] Lookup-by-attribute indexes added where queries are frequent: `(tenant_id, owner_id)`, `(tenant_id, email)`, `(tenant_id, status)` on leads.
- [ ] Migration generated and committed.
- [ ] `EXPLAIN ANALYZE` snapshot stored at `packages/db/perf/baseline.txt` for 5 representative queries; confirms `Index Scan` (not `Seq Scan`).

## Implementation Approach
- Edit `packages/db/src/schema.ts` — add `index('idx_leads_tenant_created').on(t.tenantId, t.createdAt)` per table.
- Run `pnpm exec drizzle-kit generate` to materialize SQL.
- Run baseline EXPLAIN against testcontainers PG seeded with 10K rows per table (synthetic).

## Test Strategy
- Performance: assert query latency p95 < 50ms for `SELECT … WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`.
- Regression: `pnpm test` green on PG backend.

## Rollback
Drop the index migration; tables remain functional, just slower.
