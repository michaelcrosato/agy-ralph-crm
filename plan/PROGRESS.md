# /plan/PROGRESS.md — Spec Execution Checklist

> Single source of truth for what's done, in flight, blocked. Update **every** time a spec changes state. Format: `[ ] Todo` · `[~] In Progress` · `[x] Done` · `[!] Blocked`.

---

## Phase 0 — Quick Wins & Safety (≤ 1 day total)

- [ ] **001** — [Bump Node 22 → 22.22.0+ for Jan/Mar 2026 CVEs](./specs/001_node_22_security_patch.md)
- [ ] **002** — [Biome 1.8 → 2.4 (domains, type-aware linting, plugins)](./specs/002_upgrade_biome_2_4.md)
- [ ] **003** — [Vitest 1.6 → 3.x (40% faster on large suites, Rust sharding)](./specs/003_upgrade_vitest_3.md)
- [ ] **004** — [GitHub Actions CI: enforce verify / build / test / typecheck](./specs/004_github_actions_ci.md)
- [ ] **005** — [Pin pnpm via corepack; relax engines.node](./specs/005_corepack_engines_pnpm.md)
- [ ] **006** — [Extend agent:doctor with pnpm audit + outdated checks](./specs/006_doctor_pkg_audit.md)
- [ ] **007** — [Dependabot config for weekly minor updates](./specs/007_dependabot_renovate.md)
- [ ] **008** — [Replace Math.random() IDs with uuid v7 (111 sites)](./specs/008_nanoid_uuid_v7_ids.md)

## Phase 1 — Core Upgrades (1–2 weeks)

- [ ] **010** — [Decompose apps/api/src/index.ts (331 routes / 13,060 lines)](./specs/010_decompose_apps_api.md) · deps: 001
- [ ] **011** — [Decompose packages/core/src/index.ts (100+ exports / 9,505 lines)](./specs/011_decompose_packages_core.md) · deps: 010
- [ ] **012** — [Decompose packages/db/src/index.ts (6,312 lines, 70+ stores)](./specs/012_decompose_packages_db.md)
- [ ] **013** — [Wire real Postgres + Drizzle + testcontainers](./specs/013_real_postgres_drizzle.md) · deps: 012
- [ ] **014** — [Postgres RLS policies via set_config('app.current_tenant_id')](./specs/014_rls_policies_set_local.md) · deps: 013
- [ ] **015** — [Composite (tenant_id, …) indexes on hot tables](./specs/015_composite_indexes.md) · deps: 013
- [ ] **016** — [OpenTelemetry traces + metrics + log correlation](./specs/016_otel_instrumentation.md)
- [ ] **017** — [@hono/zod-openapi for type-safe routes + auto OpenAPI](./specs/017_zod_openapi_hono.md) · deps: 010
- [ ] **018** — [Typed Hono RPC client for apps/web](./specs/018_hono_rpc_client.md) · deps: 017
- [ ] **019** — [Drizzle 0.30 → latest 0.4x; migration conflict detection](./specs/019_drizzle_upgrade.md) · deps: 013
- [ ] **020** — [Next.js 16.0.0-alpha → 16.2 stable + Turbopack + React Compiler](./specs/020_nextjs_16_stable.md)
- [ ] **021** — [Playwright config + lead/contact/opportunity smoke E2E](./specs/021_playwright_smoke_e2e.md) · deps: 020
- [ ] **022** — [Replace console.* with pino bridged to OTel](./specs/022_pino_otel_logging.md) · deps: 016
- [ ] **023** — [Decouple 129 test files from apps/api/src/index import](./specs/023_test_decouple_from_apps.md) · deps: 010
- [ ] **024** — [Declare composite + single-column indexes on Drizzle schema](./specs/024_drizzle_indexes_declare.md) · deps: 013
- [ ] **025** — [Zod-validate JSONB columns at insert/update](./specs/025_jsonb_zod_validation.md) · deps: 013

## Phase 2 — Major Features (3+ weeks)

- [ ] **030** — [Promote MCP server to packages/mcp (Twenty-style)](./specs/030_mcp_first_class.md) · deps: 011
- [ ] **031** — [Public defineObject() SDK for no-code custom objects](./specs/031_no_code_custom_objects.md) · deps: 011, 014
- [ ] **032** — [IF conditions + FOREACH loops in workflow engine](./specs/032_workflow_conditions_foreach.md) · deps: 011
- [ ] **033** — [Finish TICKET004 — tRPC dashboard analytics](./specs/033_dashboard_analytics_api.md) · deps: 011, 017
- [ ] **034** — [Finish TICKET005 — Lead SLA breach email worker](./specs/034_lead_sla_email_notifications.md) · deps: 011
- [ ] **035** — [Finish TICKET006 — picklist dependency validation](./specs/035_picklist_dependency_validation.md) · deps: 011
- [ ] **036** — [pgvector + embeddings on Accounts/Contacts](./specs/036_pgvector_semantic_search.md) · deps: 013
- [ ] **037** — [Streaming CSV import/export (10M-row safe)](./specs/037_streaming_csv_import.md) · deps: 013
- [ ] **038** — [Audit log → append-only Postgres + WORM export](./specs/038_audit_log_append_only.md) · deps: 014

---

## Active Notes

_Empty — update when claiming or releasing specs._

## Completed Specs (rolling)

_None yet — log each `[x] Done` here with `NNN @ <commit-sha> · YYYY-MM-DD · 403/403`._

## Discovered Follow-ups

_Empty — log new specs created mid-loop here._
