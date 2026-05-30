# 033 — Finish legacy TICKET004 — tRPC dashboard analytics

**Phase:** 2 · **Priority:** Medium · **Status:** `[x] Done` · **Depends on:** 011, 017

## Description & Expected Impact
Legacy `tickets/TICKET004.md` is open: implement `getLeadAnalytics` aggregating Leads count/conversion velocity/SLA per tenant. Pending since pre-audit. Now executable on the modular post-Phase-1 codebase with `@hono/zod-openapi` (spec 017) and either typed RPC client (spec 018) or a tRPC sidecar — choose Hono RPC to avoid two transport layers.

## Definition of Done & Acceptance Criteria
- [x] New route `GET /api/dashboard/analytics` registered in `apps/api/src/routes/dashboard.ts`.
- [x] Returns `{ leadCount, conversionRate, avgVelocityDays, slaBreachCount, byOwner: [...] }` per tenant.
- [x] RLS-enforced via `withTenant`; cross-tenant requests return 0 or 403.
- [x] OpenAPI doc auto-generated.
- [x] Tests in `packages/testing/src/dashboard-analytics.test.ts` cover happy path + RLS isolation + empty tenant.
- [x] Legacy `tickets/TICKET004.md` updated to `Status: completed`.

## Implementation Approach
- Aggregation runs in Postgres post-spec 013 (or in mock for non-PG envs).
- Cache results per (tenant, granularity) for 30s (Phase 2 optional optimization).

## Test Strategy
- Integration: 3 tests (happy, RLS, empty).

## Rollback
Delete route + tests.
