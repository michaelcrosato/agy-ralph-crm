# 014 — Postgres RLS policies via `set_config('app.current_tenant_id')`

**Phase:** 1 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 013

## Description & Expected Impact
With real Postgres (spec 013), tenant isolation must move from application code (70+ inline checks) to **database-enforced RLS**. Pattern: every tenant-scoped table gets `ALTER TABLE … ENABLE ROW LEVEL SECURITY`; each query wraps in a transaction that runs `SELECT set_config('app.current_tenant_id', $1, true)`; policies reference `current_setting('app.current_tenant_id')`. The `true` 3rd arg is transaction-scoped — critical for PgBouncer transaction-mode pooling. Without this, leaks happen on pool checkout.

## Definition of Done & Acceptance Criteria
- [ ] New Drizzle migration: enable RLS on every tenant-scoped table from `schema.ts`; create policy `tenant_isolation` per table.
- [ ] `packages/db/src/_tenant.ts` `withTenant(orgId, fn)` for PG backend wraps `fn` in `db.transaction(async tx => { await tx.execute(sql\`select set_config('app.current_tenant_id', ${orgId}, true)\`); return fn(tx); })`.
- [ ] Application-level `assertTenantOwns` (from spec 012) becomes a defense-in-depth assertion (kept, but RLS is the primary gate).
- [ ] 3 property-based RLS tests in `packages/testing/src/rls-property.test.ts`:
  - Cross-tenant SELECT returns 0 rows (not an error — RLS silently filters).
  - Cross-tenant UPDATE affects 0 rows.
  - Cross-tenant DELETE affects 0 rows.
- [ ] All tests pass against `DB_DRIVER=pg`.

## Implementation Approach
- Reference: AWS, Nile, ClickHouse all document the same `set_config(..., true)` pattern. Use it verbatim.
- Use `BYPASSRLS` role only for migrations / superuser tasks; application role must NOT have it.
- Add `tenant_id` as the leading column of every composite index in spec 015.
- Document the pooler caveat in `packages/db/README.md`: "Always use transaction-mode set_config; never session-level".

## Test Strategy
- Property test: fuzz 100 random org IDs × 100 random entities; assert zero cross-leak.
- Manual: connect via `psql` as app role; attempt `SET ROLE app; SELECT * FROM leads;` without `app.current_tenant_id` set → expect 0 rows or explicit error.

## Rollback
`drizzle-kit drop` the migration; revert `_tenant.ts`. App-level checks remain as fallback.

## References
- [Nile multi-tenant RLS](https://www.thenile.dev/blog/multi-tenant-rls)
- [AWS RLS multi-tenant guide](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
