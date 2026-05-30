# 041 — Follow-up: Batched route extraction for `apps/api/src/index.ts`

**Phase:** 1 (follow-up of spec 010) · **Priority:** High · **Status:** `[ ] Todo`

## Description & Expected Impact
Spec 010 milestones 1 + 2 extracted the middleware + lib helpers (5 files) and proved the routes/ pattern with `/health`. **The remaining 330 routes still live in `apps/api/src/index.ts` (12,789 lines).** This follow-up completes the per-domain split per spec 010's original DoD.

## Route batches (line ranges as of branch `spec/010-split-apps-api`)

| Batch | basePath(s) | Approx. routes | File path |
| --- | --- | --- | --- |
| 1 | `/api/auth` + `/api/public` | 4 | `routes/public.ts` |
| 2 | `/mcp/tools/*` | 3 | `routes/mcp.ts` |
| 3 | `/api/metadata/*` | 8 | `routes/metadata.ts` |
| 4 | `/api/workflows/*` + `/api/tickets/*` | ~25 | `routes/workflows.ts` + `routes/tickets.ts` |
| 5 | `/api/lead-conversions/*` + `/api/currencies/*` + `/api/stage-gates/*` + `/api/stage-guidance/*` | ~12 | `routes/lead-conversions.ts` + `routes/currencies.ts` + `routes/stages.ts` |
| 6 | `/api/leads/*` + `/api/lead-assignment-rules/*` + `/api/lead-scoring-rules/*` | ~40 | `routes/leads.ts` |
| 7 | `/api/accounts/*` | ~25 | `routes/accounts.ts` |
| 8 | `/api/contacts/*` + `/api/consent/*` | ~20 | `routes/contacts.ts` |
| 9 | `/api/opportunities/*` + `/api/approvals/*` + `/api/products/*` + `/api/pricebooks/*` | ~50 | `routes/opportunities.ts` |
| 10 | `/api/campaigns/*` + `/api/segments/*` + `/api/unsubscribes/*` | ~25 | `routes/campaigns.ts` |
| 11 | `/api/sequences/*` (marketing) | ~80 | `routes/sequences.ts` |
| 12 | `/api/service/*` + `/api/territories/*` + `/api/commissions/*` + `/api/quotas/*` | ~25 | `routes/service.ts` |
| 13 | Misc: `/api/webhooks/*`, `/api/admin/*`, `/api/db/*`, `/api/imports/*`, `/api/documents/*`, `/api/emails/*`, `/api/activities/*`, `/api/contracts/*`, `/api/invoices/*`, `/api/leaderboards/*`, `/api/productivity/*`, `/api/reports/*`, `/api/sales/*`, `/api/search/*`, `/api/subscriptions/*`, `/api/forecasting/*`, `/api/forecasts/*` | ~50 | one file per discrete domain |

## Definition of Done & Acceptance Criteria
- [ ] All 13 batches landed as separate commits (1 commit per batch).
- [ ] After each batch, `pnpm test` remains at 409+/409+ (tests are not modified).
- [ ] After batch 13, `apps/api/src/index.ts` reduced to **< 200 lines** (imports + middleware + sub-app mounts + server bootstrap + re-exports).
- [ ] No routes/*.ts file exceeds 1,500 lines (spec 010 target).
- [ ] `export default app` from `apps/api/src/index.ts` preserved verbatim so the 130 test files import unchanged.
- [ ] Branch `spec/010-split-apps-api` merged to `main` after final batch.
- [ ] PROGRESS.md updated to mark spec 010 fully done.

## Implementation Approach
- **Strict 1-batch-per-commit discipline.** Test + commit between batches.
- For each batch:
  1. `git checkout spec/010-split-apps-api`
  2. Find the `app.<method>(basePath/*` ranges in `apps/api/src/index.ts` (use `grep -nE '^app\.(get|post|put|delete|patch)\("<basePath>'`).
  3. Create `apps/api/src/routes/<domain>.ts` with `export const <name>App = new Hono<Env>()` and rewrite the handlers as `<name>App.<method>("/<rest>", …)`.
  4. Replace the original `app.<method>("<basePath>/<rest>", …)` calls in `index.ts` with a single `app.route("<basePath>", <name>App)` mount.
  5. Run `pnpm --filter api build && pnpm --filter @crm/testing test`. Must be 409/409.
  6. Commit `refactor(spec/041,batch-N): extract <domain> routes`.
- Handlers that depend on shared helpers (`triggerOutboundWebhooks`, `checkAndRunLeadAutoConversion`, etc.) re-import from `../lib/*` and `../middleware/tenantAuth`.
- Preserve route registration order where it matters (Hono is method+path keyed but `/leads/:id/conversions` must register before `/leads/:id`).

## Test Strategy
- Regression: `pnpm test` must remain at 409/409 after every batch.
- Build: `pnpm build` must be green after every batch.
- Spot-check: 3 cURL smoke calls per batch in dev mode (`pnpm dev`).
- Final: full `pnpm verify && pnpm build && pnpm test && pnpm test:e2e`.

## Rollback
`git checkout main; git branch -D spec/010-split-apps-api`. No DB schema or migration impact.

## Why this is a separate spec
Spec 010's full DoD requires moving 12,800+ lines across 14 files. Even with sub-agents one-per-domain, careful coordination is needed to preserve the 130 test files' imports. Each batch is a discrete, ~30–60 min focused unit of work. Splitting into 13 commits is the safest path to landing this without regressing the test count or risking partial-state failures on `main`.
