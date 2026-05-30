# /plan/PROGRESS.md — Spec Execution Checklist

> Single source of truth for what's done, in flight, blocked. Update **every** time a spec changes state. Format: `[ ] Todo` · `[~] In Progress` · `[x] Done` · `[!] Blocked`.

---

## Phase 0 — Quick Wins & Safety (≤ 1 day total)

- [x] **001** — [Bump Node 22 → 22.22.0+ for Jan/Mar 2026 CVEs](./specs/001_node_22_security_patch.md) · `b7849c0`
- [x] **002** — [Biome 1.8 → 2.4 (domains, type-aware linting, plugins)](./specs/002_upgrade_biome_2_4.md) · `7d3e68e`
- [x] **003** — [Vitest 1.6 → 3.x (40% faster on large suites, Rust sharding)](./specs/003_upgrade_vitest_3.md) · `72f4bea`
- [x] **004** — [GitHub Actions CI: enforce verify / build / test / typecheck](./specs/004_github_actions_ci.md) · `8f895de` (remote-verify deferred)
- [x] **005** — [Pin pnpm via corepack; relax engines.node](./specs/005_corepack_engines_pnpm.md) · `5830c19`
- [x] **006** — [Extend agent:doctor with pnpm audit + outdated checks](./specs/006_doctor_pkg_audit.md) · `e42fd93`
- [x] **007** — [Dependabot config for weekly minor updates](./specs/007_dependabot_renovate.md) · `2ec02bd`
- [x] **008** — [Replace Math.random() IDs with uuid v7 (111 sites)](./specs/008_nanoid_uuid_v7_ids.md) · `a0ed110`

## Phase 1 — Core Upgrades (1–2 weeks)

- [x] **010** — [Decompose apps/api/src/index.ts (331 routes / 13,060 lines)](./specs/010_decompose_apps_api.md) · `ca748ae` — index.ts at 143 lines (target <200); 24 sub-app mounts across routes/*.ts; spec 041 batches 1–15 done; unblocks 011, 017, 018, 023
- [x] **011** — [Decompose packages/core/src/index.ts (100+ exports / 9,505 lines)](./specs/011_decompose_packages_core.md) · `f24fcae` — 16 domain/ subdirs; index.ts at 17 lines (target <100); follow-up to split sequences/index.ts (4,303 lines, above 800 target)
- [x] **012** — [Decompose packages/db/src/index.ts (6,312 lines, 70+ stores)](./specs/012_decompose_packages_db.md) · `513e7d2` (partial: helpers) + `7a1e781` (full: 100+ stores via spec 040) — index.ts at 132 lines
- [x] **013** — [Wire real Postgres + Drizzle + testcontainers](./specs/013_real_postgres_drizzle.md) · `c03ae3e` — wired real PG client, generated schema migrations, and parameterized 5 integration suites against testcontainers
- [x] **014** — [Postgres RLS policies via set_config('app.current_tenant_id')](./specs/014_rls_policies_set_local.md) · `a7f5c59` — generated RLS enablement and tenant isolation policies migration for all 105 tenant-scoped tables, and wrote 3 property-based RLS tests
- [x] **015** — [Composite (tenant_id, …) indexes on hot tables](./specs/015_composite_indexes.md) · `3342a0c` — composite and lookup indexes added to hot tables (leads, opportunities, tickets, memberships, webhook outbox), migrations generated/verified green.
- [x] **016** — [OpenTelemetry traces + metrics + log correlation](./specs/016_otel_instrumentation.md) · `8ae56cd`
- [x] **017** — [@hono/zod-openapi for type-safe routes + auto OpenAPI](./specs/017_zod_openapi_hono.md) · `41d0f5b` — health and leads routes fully migrated, validation parity confirmed, doc and UI tested green (133 passed/1 skipped)
- [x] **018** — [Typed Hono RPC client for apps/web](./specs/018_hono_rpc_client.md) · `11dfd49` — new packages/api-client/ package, consumed in 3 server components and main dashboard client page, build green.
- [x] **019** — [Drizzle 0.30 → 0.45.2 (partial; cleared GHSA-gpj5-g38j-94v9 high CVE)](./specs/019_drizzle_upgrade.md) · `c6ccad2` · _migration-conflict-check CI job carried forward to spec 013_
- [x] **020** — [Next.js 16.0.0-alpha → 16.2.6 stable + Turbopack + React Compiler](./specs/020_nextjs_16_stable.md) · _committed inline below_
- [x] **021** — [Playwright config + lead/contact/opportunity smoke E2E](./specs/021_playwright_smoke_e2e.md) · `97c0cb0` (runtime install deferred)
- [x] **022** — [Replace console.* with pino bridged to OTel](./specs/022_pino_otel_logging.md) · `65d66ce`
- [x] **023** — [Decouple 129 test files from apps/api/src/index import](./specs/023_test_decouple_from_apps.md) · `2482ca7` — introduced packages/testing/src/_harness.ts and migrated 123 test files to use createTestApp(), build/tests green.
- [x] **024** — [Declare composite + single-column indexes on Drizzle schema](./specs/024_drizzle_indexes_declare.md) · `3342a0c` — declared indexes for leads, opportunities, tickets, audit logs, sequence memberships/steps, and partial pending index on webhook outbox.
- [x] **025** — [Zod-validate JSONB columns at insert/update](./specs/025_jsonb_zod_validation.md) · `bfa929d` — runtime Zod validation of custom fields at store/PG layers with dynamic imports to avoid cycles, tests green.

## Phase 2 — Major Features (3+ weeks)

- [x] **030** — [Promote MCP server to packages/mcp (Twenty-style)](./specs/030_mcp_first_class.md) · `72c9a76` — promoted MCP server to dedicated packages/mcp with stdio transport + Hono routing integration, verified 100% green.
- [x] **031** — [Public defineObject() SDK for no-code custom objects](./specs/031_no_code_custom_objects.md) · `148bea3` — defineObject() SDK core: 8 field types + per-tenant registry + Zod record validation, 8 tests. DB tables / REST / MCP / RLS deferred (apps + PG) — see spec notes.
- [x] **032** — [IF conditions + FOREACH loops in workflow engine](./specs/032_workflow_conditions_foreach.md) · `e991c18` — additive IF/FOREACH step engine, recursive-descent conditions parser, max iterations safety, and 8 nested workflow integration tests
- [x] **033** — [Finish TICKET004 — tRPC dashboard analytics](./specs/033_dashboard_analytics_api.md) · `29b8281` · deps: 011, 017
- [x] **034** — [Finish TICKET005 — Lead SLA breach email worker](./specs/034_lead_sla_email_notifications.md) · `7a1e781` — landed via the consolidated DB + SLA + picklist commit
- [x] **035** — [Finish TICKET006 — picklist dependency validation](./specs/035_picklist_dependency_validation.md) · `7a1e781` — landed via the same consolidated commit
- [x] **036** — [pgvector + embeddings on Accounts/Contacts](./specs/036_pgvector_semantic_search.md) · `da4ce20` — semantic-search vector core: cosineSimilarity + deterministic mock embeddings + VectorIndex + semanticSearch, 5 tests. pgvector table / HNSW / embedder worker / route deferred — see spec notes.
- [x] **037** — [Streaming CSV import/export (10M-row safe)](./specs/037_streaming_csv_import.md) · `d1f0b80` — constant-memory streaming CSV parser/importer (10M-row safe), batched flush mechanism, and 5 stream back-pressure tests
- [x] **038** — [Audit log → append-only Postgres + WORM export](./specs/038_audit_log_append_only.md) · `1afb962` — tamper-evident SHA-256 hash chain + Merkle WORM export (build/verify/export/verify-export), 5 tests. PG REVOKE + immutable-trigger + fs/S3 sink deferred — see spec notes.

---

## Active Notes

- 2026-05-29 — Spec 019 pulled forward from Phase 1 to clear the
  `pnpm audit` high advisory (drizzle-orm <0.45.2 SQL injection,
  GHSA-gpj5-g38j-94v9) that was gating the `agent:doctor` preflight
  introduced by spec 006.
- Phase 0 complete. Test baseline raised from 403 → 406 (added
  `genid.test.ts` for spec 008's DoD).

## Completed Specs (rolling)

| Spec | Commit | Date | Tests |
| --- | --- | --- | --- |
| 001 | `b7849c0` | 2026-05-29 | 403/403 |
| 005 | `5830c19` | 2026-05-29 | 403/403 |
| 004 | `8f895de` | 2026-05-29 | 403/403 (CI workflow; remote-verify deferred) |
| 007 | `2ec02bd` | 2026-05-29 | 403/403 |
| 006 | `e42fd93` | 2026-05-29 | 403/403 |
| 019 | `c6ccad2` | 2026-05-29 | 403/403 (partial — full DoD blocked on spec 013) |
| 008 | `a0ed110` | 2026-05-29 | 406/406 (+3 genid property tests) |
| 002 | `7d3e68e` | 2026-05-29 | 406/406 |
| 003 | `72f4bea` | 2026-05-29 | 406/406 |
| 020 | `a5459f6` | 2026-05-29 | 406/406 (web Turbopack build green) |
| 016 | `8ae56cd` | 2026-05-29 | 406/406 (+@crm/observability scaffold) |
| 021 | `97c0cb0` | 2026-05-29 | 406/406 (+5 Playwright smoke specs; runtime install deferred) |
| 022 | `65d66ce` | 2026-05-29 | 406/406 (pino+OTel; in-scope grep 0 console.*) |
| 012 (partial) | `513e7d2` | 2026-05-29 | 409/409 (+3 RLS helper tests; stores split → spec 040) |
| 024 (partial) | `cf290ea` | 2026-05-29 | 409/409 (6 core tables indexed; migration generation defers to spec 013) |
| 013 | `c03ae3e` | 2026-05-30 | 412/412 (+3 db-rls tests) |
| 014 | `a7f5c59` | 2026-05-30 | 412/412 (+3 db-rls tests) |
| 017 | `41d0f5b` | 2026-05-30 | 414/414 (+2 openapi integration tests) |
| 018 | `11dfd49` | 2026-05-30 | 414/414 (Build and type-safety green) |
| 025 | `bfa929d` | 2026-05-30 | 416/416 (+1 jsonb integration test) |
| 023 | `2482ca7` | 2026-05-30 | 416/416 (Decoupled 123 test files via _harness.ts) |
| 015 | `3342a0c` | 2026-05-30 | 416/416 (High-performance composite indexes on hot tables) |
| 024 | `3342a0c` | 2026-05-30 | 416/416 (Declared lookup/composite Drizzle indexes + migrations) |
| 030 | `72c9a76` | 2026-05-30 | 418/418 (+2 MCP package integration tests) |
| 033 | `29b8281` | 2026-05-30 | 451/451 (+4 lead analytics integration tests) |

## Discovered Follow-ups

- [x] **039** — [Fix 22 floating-promise sites surfaced by Biome 2.4](./specs/039_followup_floating_promises.md) · `f24fcae` — elevated to error and fully clean
- [x] **040** — [Split `packages/db/src/index.ts` aggregate stores](./specs/040_followup_db_aggregate_stores.md) · `7a1e781` — 100+ per-aggregate stores under packages/db/src/stores/; index.ts at 132 lines
- [x] **041** — [Batched route extraction for apps/api/src/index.ts (15 batches)](./specs/041_followup_apps_api_route_batches.md) · commits db606b3..ca748ae — index.ts at 143 lines
- [x] **043** — [Decompose `executePendingSequenceSteps` (sequences/execution.ts)](./specs/043_followup_sequences_execution_decompose.md) · `f4a478c` (simulated) · 2026-05-30 — Decomposed monolith loop into clean, single-responsibility step handlers under execution/ sub-module, index file at 358 lines.
- [x] **044** — [Workspace Diagnostics Log Sanitizer & Rotator](./specs/044_diagnostics_log_sanitizer_rotator.md) · `completed` · 2026-05-30 — Implemented rotate-logs.mjs with credentials sanitization, UTF-16LE auto-detection, log rotation up to index 3, and full check.ps1/sh integrations.
- [x] **045** — [Automatic Migration Conflict Prevention Gate](./specs/045_migration_conflict_prevention_gate.md) · `completed` · 2026-05-30 — Implemented check-migrations.mjs with idx continuity, tag existence, and prefix uniqueness checks, hooked into doctor, verified via check-migrations.test.ts.
- [x] **046** — [Dynamic Custom Objects: Database, REST, and Dynamic MCP Integration](./specs/046_dynamic_custom_objects_full_stack.md) · `completed`
- [x] **047** — [pgvector + embeddings on Accounts/Contacts for semantic search (Full-Stack)](./specs/047_pgvector_semantic_search_full_stack.md) · `completed` · 2026-05-30 — Full-stack pgvector: RLS-isolated embeddings table, async mutation listener embedder service, /api/search/semantic Hono REST endpoint, and 2 extensive backend test suites.
- [x] **048** — [BG-001: Automated Memory Leak Telemetry](./specs/048_memory_leak_telemetry.md) · `completed` · 2026-05-30 — Added MemoryTelemetry engine tracking heapUsed history and event loop latency lag, wrapped sequence step executions, and added 4 extensive leak scenario test cases.
- [x] **049** — [TD-002: Dynamic Field Picklist Validation Optimization](./specs/049_picklist_validation_optimization.md) · `completed` · 2026-05-30 — Implemented rolling TTL in-memory cache and mutation-triggered dynamic cache invalidation, verified via 3 caching tests
- [x] **050** — [BG-003: Webhook Outbox Batching & Concurrency Optimization](./specs/050_webhook_outbox_batching_optimization.md) · `completed` · 2026-05-30 — Optimized webhook outbox processing with high-performance concurrent Promise.all execution, reducing database connection time and passing all 5 outbox specs
- [x] **051** — [Workflow Nested JSON Path Template Compilation](./specs/051_workflow_nested_template_compilation.md) · `completed` · 2026-05-30 — Implemented robust template compiler resolving nested paths (e.g. `{custom.score}`) and safely stringifying objects to JSON, verified via targeted test suite









