# 010 — Decompose `apps/api/src/index.ts` (331 routes / 13,060 lines)

**Phase:** 1 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 001

## Description & Expected Impact
Single Hono entry file holds **331 routes** spanning leads, accounts, contacts, opportunities, campaigns, sequences, service tickets, MCP, metadata, workflows, currencies, lead-conversions, and stages. Audit confirms 20+ `as unknown` casts at the DB boundary and inline-duplicated RLS assertions. Splitting by domain is prerequisite to: spec 017 (zod-openapi), spec 023 (test decoupling), spec 030 (MCP first-class), and any spec that touches routes.

## Definition of Done & Acceptance Criteria
- [ ] New directory `apps/api/src/routes/` with one file per domain:
  - `leads.ts`, `accounts.ts`, `contacts.ts`, `opportunities.ts`, `campaigns.ts`, `sequences.ts`, `service.ts`, `tickets.ts`, `metadata.ts`, `workflows.ts`, `currencies.ts`, `lead-conversions.ts`, `stages.ts`, `mcp.ts`, `health.ts`.
- [ ] Each file exports a `Hono` sub-app: `export const leadsApp = new Hono().basePath('/api/leads')...`.
- [ ] `apps/api/src/index.ts` reduced to **< 200 lines**: imports + middleware + `app.route('/api/leads', leadsApp)` mounts + server startup.
- [ ] Shared middleware (`tenantAuth`, `enforcePicklistDependencies`, `enforceCustomValidationRules`) extracted to `apps/api/src/middleware/`.
- [ ] Shared util helpers (`checkAndRunLeadAutoConversion`, `handleTicketEscalationEvent`, etc.) extracted to `apps/api/src/lib/` and re-exported from `apps/api/src/index.ts` (preserves test imports until spec 023 lands).
- [ ] All 403 tests still pass without changes.
- [ ] `apps/api/src/index.ts` file size < 8KB.

## Implementation Approach
- Sub-agent strategy: spawn one Agent per domain (e.g. "Extract /api/leads* routes into apps/api/src/routes/leads.ts; preserve handler bodies verbatim"). Cap each agent at one domain to keep context manageable.
- Use Hono's `app.route(basePath, subApp)` (https://hono.dev/docs/api/routing) — no behavior change.
- Preserve route registration order where order matters (e.g., `/leads/:id/conversions` must register before `/leads/:id` if currently relied upon).
- Keep `export default app` from `apps/api/src/index.ts` intact so tests continue to import without churn.
- Type-cast cleanup is OUT OF SCOPE — file a follow-up. This spec is mechanical refactor only.

## Test Strategy
- Regression: `pnpm test` 403/403 must still pass. Any test failure indicates a missed route or middleware reorder.
- Manual: `curl localhost:3001/health` returns 200; smoke 3 endpoints per domain.
- Code review gate: each routes file must be < 1,500 lines (target avg 800).

## Rollback
`git restore apps/api/src/` — full restore. No DB schema or migration impact.

## References
- [Hono routing — sub-apps](https://hono.dev/docs/api/routing)
