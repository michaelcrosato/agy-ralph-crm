# TICKET004: Interactive tRPC Dashboard Analytics API

## Details
- **Status**: pending
- **Priority**: High
- **Goal**: Implement a high-performance analytics endpoint inside Hono/tRPC routers to aggregate Leads count, conversion velocity, and SLA statuses by active tenant.
- **Context**: The frontend dashboard panel requires quick telemetry access to render metrics under strict organization RLS isolation.

---

## Scope

### In Scope
- Define tRPC router procedure `getLeadAnalytics` in `apps/api/src/` or Hono controller `GET /api/dashboard/analytics`.
- Query Drizzle tables to count Leads matching `status` grouped by organisation.
- Add strict multi-tenant RLS checks verifying that only the active tenant organization's records are aggregated.
- Append extensive Vitest unit tests under `packages/testing/src/dashboard-analytics.test.ts`.

### Out of Scope
- Adding new UI visualizations or charts inside Next.js pages.

---

## Technical Mappings

- **Likely Files**:
  - `apps/api/src/index.ts`
  - `packages/db/src/index.ts`
  - `packages/testing/src/dashboard-analytics.test.ts`

---

## Steps to Execute
1. Set up a secure `getLeadAnalytics` endpoint inside `apps/api/src/index.ts` wrapped with the `tenantAuth` middleware.
2. Fetch Leads metrics via `dbStore` inside the RLS tenant block context.
3. Compute the conversion rate and count of fuzzed/typo entries.
4. Run standard linter validation and typecheck compilation via `pnpm verify`.
5. Run targeted tests via `npx vitest run packages/testing/src/dashboard-analytics.test.ts`.

---

## Acceptance Criteria
- [ ] Endpoint `GET /api/dashboard/analytics` successfully returns aggregated JSON telemetry.
- [ ] Non-authenticated or mismatched tenant request returns `401` or `RLS Violation`.
- [ ] Aggregate counts match exactly with the active tenant's database seed.

---

## Verification Commands
```bash
npx vitest run packages/testing/src/dashboard-analytics.test.ts
pnpm verify
```

---

## Risks & Notes
- **Risk**: Performance drag when aggregating large mock seed sets.
- **Note**: Ensure indexes are queried efficiently.
