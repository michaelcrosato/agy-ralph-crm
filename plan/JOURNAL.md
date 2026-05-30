# /plan/JOURNAL.md — Append-Only Execution Resume Log

---

## [2026-05-30] Cycle 1 — Initialization & Verification Baseline

### 1. REPO BASELINE
- **Stack**: Node v24 (v22 target), `pnpm` workspaces, Turborepo, Next.js 16.2 stable, Hono, Drizzle, mock Postgres + testcontainers, Biome 2.4, Vitest 3.2.4.
- **Verification Command (`VERIFY_CMD`)**: `pnpm run agent:check` (combines formatting, linting, compile verification, and full test execution).
- **Test Baseline**: 142 passed test files, 469 passed tests. Zero failures.
- **Observations**:
  - Codebase is extremely clean and fast due to full Turborepo caching.
  - Spec 043 (`executePendingSequenceSteps` refactoring) is the next unblocked priority task.
  - Active branch is `main`, clean working tree.

### 2. ARCHITECTURAL FINDINGS
- `packages/core/src/domain/sequences/execution.ts` contains `executePendingSequenceSteps` which spans ~1,410 lines within a ~1,439-line file. It violates the `ralph.yml` 400-line standard by 3.5× and represents a major readability/maintainability blocker for future sequence feature extensions.
- All other domain segments are properly decoupled.

### 3. ACTION PLAN
- Execute Spec **043** — decompose the monolith `executePendingSequenceSteps` loop into clean, single-responsibility step handlers (`executeEmailStep`, `executeTaskStep`, `executeSmsStep`, `executeCallStep`, `executeWebhookStep`, `executeBranchStep`).
- Maintain exact regression parity (verify that 100% of the 469 tests pass).

### 4. EXECUTION LOG & VERIFICATION (Spec 043)
- **Action**: Refactored the monolith `packages/core/src/domain/sequences/execution.ts` (~1,437 lines) by extracting individual step type branches into dedicated single-responsibility modules:
  - `execution/types.ts` — Shared `SequenceDbStore` interface.
  - `execution/helpers.ts` — `advanceMembershipToNextStep` and `executeBranchStep`.
  - `execution/task.ts` — `executeTaskStep`.
  - `execution/sms.ts` — `executeSmsStep`.
  - `execution/call.ts` — `executeCallStep`.
  - `execution/webhook.ts` — `executeWebhookStep`.
  - `execution/email.ts` — `executeEmailStep` (includes A/B split testing and thread logic).
- **Result**:
  - `execution.ts` is now only 358 lines, satisfying the standard 400-line budget limit of `ralph.yml`.
  - Compile step (`tsc`) runs successfully for all dependent packages.
  - Comprehensive verification check `pnpm run agent:check` completed successfully with `0` exit status.
  - Exact regression parity: **142/142 test files** and **469/469 tests** passed cleanly.

## [2026-05-30] Cycle 2 — Workspace Diagnostics Log Sanitizer & Rotator

### 1. REPO BASELINE
- **Branch**: `main`, fully clean working tree.
- **Verification Command**: `pnpm run agent:check` (combines Biome formatting, lint checks, typescript builds, and Vitest test suites).
- **Test Baseline**: 142 passed test files, 469 passed tests.

### 2. ARCHITECTURAL FINDINGS & TICKET009
- Continuous autonomous agent execution appends log output to `test_output.log`, which can grow very large (> 2MB), causing token bloat during directory scans/listings.
- Logs can occasionally print sensitive auth/Bearer tokens, private keys, or passwords.
- Redaction and rotation of these logs is necessary. Normalizing output to UTF-8 resolves PowerShell UTF-16LE read errors (`unsupported mime type text/plain; charset=utf-16le`).

### 3. ACTION PLAN & IMPLEMENTATION (Spec 044)
- Developed `scripts/agent/rotate-logs.mjs` with:
  - UTF-16LE and UTF-8 auto-detection.
  - High-performance regex filters targeting Bearer headers, JWTs, inline passwords/secrets, and PEM private keys.
  - White-space preservation logic for key-value separators (preserving exact spacing).
  - Rotation shift indexing up to `.3.log`.
  - Normalization to UTF-8.
- Integrated `agent:rotate-logs` npm script into root `package.json`.
- Integrated execution at the end of successful `check.ps1` and `check.sh` runs.
- Developed comprehensive integration tests in `packages/testing/src/rotate-logs.test.ts`.

### 4. VERIFICATION LOG
- Ran targeted Vitest tests: `npx vitest run packages/testing/src/rotate-logs.test.ts` (3/3 passed).
- Ran workspace-wide pre-check: `pnpm run agent:check` (143/143 test files and 472/472 tests passed 100% cleanly).
- Formatting and linting validated green via Biome.

## [2026-05-30] Cycle 3 — Dynamic Custom Objects: Database, REST, and MCP Integration

### 1. REPO BASELINE
- **Branch**: `main`, fully clean working tree (pre-commit).
- **Verification Command**: `pnpm verify` and `pnpm test`
- **Test Baseline**: 144 passed test files, 477 passed tests.

### 2. ARCHITECTURAL FINDINGS
- Twenty's no-code Custom Objects architecture requires full integration across:
  - Database schema models (`custom_entity_types` and `custom_entity_records` tables).
  - In-memory mock store registries (`customEntityTypesStore` & `customEntityRecordsStore`) for fast mock backend testing.
  - Dynamically mounted Hono REST endpoints `/api/custom/:typeName` supporting full CRUD (insert, list, retrieve, patch, delete) with runtime-compiled Zod validation.
  - Autocomplete and Model Context Protocol (MCP) dynamic tool resolution (`crm_create_<objectName>`, `crm_get_<objectName>`, etc.) inside `packages/mcp`.

### 3. ACTION PLAN & IMPLEMENTATION (Spec 046)
- **Database Schema**: Declared `customEntityTypes` and `customEntityRecords` tables with indexes and references in `packages/db/src/schema.ts`.
- **Database Mappings**: Added DBCustomEntityType and DBCustomEntityRecord interfaces in `_store.ts` and registered them in the global `store` registry.
- **Mock Stores**: Implemented `customEntityTypes.ts` and `customEntityRecords.ts` mock stores, registering them in `mockStores` and `storeMetadata` in `pg-factory.ts`.
- **Drizzle Migrations**: Generated migration `0003_charming_princess_powerful.sql` using Drizzle Kit.
- **REST Endpoints**: Created Hono route app `apps/api/src/routes/custom.ts` providing CRUD handling under `/api/custom/:typeName` scoped strictly per tenant orgId. Registered the sub-app on `/api/custom` in `apps/api/src/index.ts`.
- **Dynamic MCP Tools**: Updated `packages/mcp/package.json` to depend on `@crm/metadata` and updated `packages/mcp/src/index.ts` to dynamically resolve custom entity types and create tools for them (`crm_get_<obj>`, `crm_list_<obj>`, `crm_create_<obj>`, `crm_update_<obj>`, `crm_delete_<obj>`). Supported dynamic execution of these tools.
- **Integration Tests**: Added `packages/testing/src/custom-objects-full-stack.test.ts` providing comprehensive REST API and MCP server CRUD assertions with strict organization tenant RLS verification.

### 4. VERIFICATION LOG
- Formatted drizzle metadata snapshot files via Biome.
- Ran targeted Vitest tests: `npx vitest run packages/testing/src/custom-objects-full-stack.test.ts` (4/4 passed).
- Ran workspace-wide verification checks: `pnpm verify` (completed successfully with exit status 0).
- Ran full workspace test suite: `pnpm test` (145/145 test files, 481/481 tests passed 100% cleanly).

## [2026-05-30] Cycle 4 — pgvector Semantic Search: Database, Async Embedder, and Hono REST API

### 1. REPO BASELINE
- **Branch**: `main`, active work in progress.
- **Verification Command**: `pnpm verify` and `pnpm test`
- **Test Baseline**: 145 passed test files, 481 passed tests.

### 2. ARCHITECTURAL FINDINGS
- Setting up full-stack pgvector search requires robust asynchronous queue-based generation of embeddings that is strictly compliant with multi-tenant database RLS boundaries.
- Because background worker jobs run asynchronously out of the request context thread, they must explicitly invoke DB operations within a tenant session (`withTenant(item.orgId, ...)`).
- When running under test environments, separate copies/instances of modules may be loaded (e.g. package source vs compiled dist in monorepos). Attaching state listeners (like `onMutationCallback`) on `globalThis` completely avoids module duplication synchronization issues.
- A deterministic offline mock embedding provider can simulate realistic keyword/trigram matching by tokenizing and summing token vector components, ensuring tests run fully green without active external OpenAI credentials.

### 3. ACTION PLAN & IMPLEMENTATION (Spec 047)
- **Database Schema**: Established pgvector table `embeddings` with orgId, entityType, entityId, and HNSW cosine similarity vector index on Postgres. Patched Drizzle migrations to ensure vector extension is created.
- **Robust Async Worker**: Implemented a queue-based `EmbedderService` worker listening to Account and Contact insert/updates. Wrapped all database calls in `withTenant` blocks using the target entity's `orgId` to ensure multi-tenant RLS compliance.
- **Decoupled Event Registry**: Stored the mutation listener directly on `globalThis` (`globalThis.__crm_onMutationCallback`) to bridge multiple package instantiations.
- **High-Fidelity Mock Embedder**: Enhanced `createMockEmbeddingProvider` to use token/trigram vector sum composition. This allows realistic offline semantic and keyword matches (e.g. matching "artificial intelligence search engine" to "Google AI Search").
- **REST Endpoint**: Implemented `/api/search/semantic` endpoint with strict organization-level RLS context and fast PG native `<=>` cosine distance operations (and mock fallback cosine similarity).
- **Integration Tests**: Created `packages/testing/src/semantic-search-full-stack.test.ts` asserting exact rank order, RLS tenant-isolation boundaries (Tenant A results invisible to Tenant B), and async generation.

### 4. VERIFICATION LOG
- Rebuilt packages and ran targeted tests: `npx vitest run packages/testing/src/semantic-search-full-stack.test.ts` (passed cleanly on both mock and pgvector Postgres testcontainer backends).
- Validated whole workspace type safety and formatting: `pnpm verify` (100% green).
- Executed whole workspace test suite: `pnpm test` (all 146 files, 483 tests passed cleanly).

## [2026-05-30] Cycle 5 — Automated Memory Leak Telemetry & Monitoring

### 1. REPO BASELINE
- **Branch**: `main`, fully clean working tree.
- **Verification Command**: `pnpm verify` and `pnpm test`
- **Test Baseline**: 146 passed test files, 483 passed tests.

### 2. ARCHITECTURAL FINDINGS
- Under high-frequency sequence processing loops, long-running processes are highly susceptible to silent memory leaks and event loop blockages.
- Integrating a low-overhead sampling utility using Node's native `perf_hooks` (e.g. `monitorEventLoopDelay`) and `process.memoryUsage` allows precise diagnostic insight.
- Tracking rolling `heapUsed` history (up to 5 samples) enables deterministic mathematical detection of monotonic heap growth (continuous increasing allocations above warning thresholds) to identify leaks.
- Incorporating memory check hooks inside sequence processing loops (`executePendingSequenceSteps`) ensures continuous monitoring under active production work.

### 3. ACTION PLAN & IMPLEMENTATION (Spec 048)
- **Telemetry Utility**: Implemented `MemoryTelemetry` in `packages/observability/src/memory.ts` tracking event loop mean/max lag and heap history. Configured warning/critical thresholds and structured Pino warning outputs. Exposed `start()`, `stop()`, and `check()` methods.
- **Monorepo Exports**: Added `MemoryTelemetry` to exports in `packages/observability/src/index.ts`. Added dependencies to `@crm/core` and `@crm/testing` to safely enable workspace imports.
- **Sequence Integration**: Embedded dynamic `MemoryTelemetry.check()` wraps inside `executePendingSequenceSteps` loop iteration cycles to monitor active memory utilization during step processing.
- **Integration Tests**: Added `packages/testing/src/memory-telemetry.test.ts` featuring rolling history assertions, event loop lag, non-monotonic health, and simulated leakage alert triggers.

### 4. VERIFICATION LOG
- Rebuilt packages and executed targeted tests: `npx vitest run packages/testing/src/memory-telemetry.test.ts` (4/4 tests passed 100% green).
- Formatted and resolved lint rules using Biome (100% compliant).
- Verified the complete workspace compiler and linter rules: `pnpm verify` (completed successfully with exit status 0).
- Executed the full workspace test suite: `pnpm test` (all 147 files, 487 tests passed 100% green and regression-free).

## [2026-05-30] Cycle 6 — Picklist & Validation Caching (Spec 049) + Webhook Concurrency (Spec 050)

### 1. REPO BASELINE
- **Branch**: `main`, fully clean working tree.
- **Verification Command**: `pnpm verify` and `pnpm test`
- **Test Baseline**: 147 passed test files, 487 passed tests.

### 2. ARCHITECTURAL FINDINGS
- Every record creation/patch triggers sequential DB queries for validation rules and picklist dependencies, multiplying network latency overhead.
- Scoping in-memory cache definitions by tenant (`orgId`) maintains strict RLS boundaries and completely isolates Tenant data.
- Overriding store accessors using a Proxy inside `packages/db` enables dynamic cache invalidation on any `insert`, `update`, or `delete` writes.
- Processing outbound webhook delivery jobs concurrently using `Promise.all` minimizes total queue execution holding time and improves transactional connection throughput.

### 3. ACTION PLAN & IMPLEMENTATION
- **Validation Cache (Spec 049)**:
  - Added rolling TTL in-memory caching mapping tenant `orgId` in `apps/api/src/lib/validation.ts`.
  - Exposed `clearValidationCaches()` helper.
  - Attached dynamic cache invalidation trigger using `globalThis.__crm_onValidationMutation` in `packages/db/src/index.ts` Proxy intercepts.
  - Created `packages/testing/src/validation-caching.test.ts` asserting TTL correctness, automatic invalidation on writes, and manual clearing.
- **Webhook Concurrency (Spec 050)**:
  - Promoted BG-003 to active Spec 050.
  - Refactored sequential outbound webhook worker loop to perform concurrent dispatches via `Promise.all` in `packages/webhooks/src/index.ts`.
  - Ensured correct asynchronous counters for successes, failures, and DLQ movements.

### 4. VERIFICATION LOG
- Rebuilt packages and executed targeted checks: `npx vitest run packages/testing/src/validation-caching.test.ts` (3/3 green) and `webhook-outbox.test.ts` (5/5 green).
- Ran linter, formatter, and typecheck: `pnpm verify` (100% successful with exit code 0).
- Ran entire monorepo-wide test suite: `pnpm test` (all 148 test files, 490 tests passed 100% green and regression-free).

## [2026-05-30] Cycle 7 — Workflow Nested Path Template Compilation (Spec 051)

### 1. REPO BASELINE
- **Branch**: `main`, fully clean working tree.
- **Verification Command**: `pnpm verify` and `pnpm test`
- **Test Baseline**: 148 passed test files, 490 passed tests.

### 2. ARCHITECTURAL FINDINGS
- Restricting ECA workflow templating to root-level keys limits capability to process complex event payloads.
- Reusing the recursive path resolver (`resolvePath`) enables standard dot-notation path resolution (e.g. `{custom.score}`) inside action template interpolation seamlessly.
- Properly stringifying object/array values to JSON prevents `"[object Object]"` output and ensures native compatibility with rich nested payload formats.

### 3. ACTION PLAN & IMPLEMENTATION
- **Workflow Nested Paths (Spec 051)**:
  - Centralized robust template interpolation inside a `compileTemplate` utility using `resolvePath` under `packages/workflow/src/index.ts`.
  - Configured safe JSON stringification fallback for nested objects and arrays.
  - Linked the template compiler to both webhook and notification action dispatches inside `executeWorkflows`.
  - Added intensive unit assertions checking nested dot path resolution and object serialization to JSON within `packages/testing/src/workflow-eca-upgrades.test.ts`.

### 4. VERIFICATION LOG
- Rebuilt workflow packages: `pnpm --filter @crm/workflow build`.
- Ran targeted tests: `npx vitest run packages/testing/src/workflow.test.ts packages/testing/src/workflow-eca-upgrades.test.ts` (8/8 green).
- Ran linter, formatter, and compiler checks: `pnpm verify` (100% successful with exit code 0).
- Executed full workspace test suite: `pnpm test` (all 148 test files, 491 tests passed 100% green and regression-free).

## [2026-05-30] Cycle 8 — Phase 3 Production Hardening and Monolith Decomposition (Specs 052-063)

### 1. REPO BASELINE
- **Branch**: `main`, fully clean working tree.
- **Verification Command**: `pnpm verify` and `pnpm test`
- **Test Baseline**: 150 passed test files, 511 passed tests.

### 2. ARCHITECTURAL FINDINGS
- A singular giant entrypoint for routing or domain logic leads to high token consumption, poor maintainability, and regression risk.
- Decomposing Hono sub-routers into focused sub-modules under `routes/leads/`, `routes/opportunities/`, `routes/sequences/`, and `routes/service/` drastically keeps standard files within the authoritative line budget constraint.
- Standard secure headers and targeted rate limiting provide robust protection against brute-force, CSRF, XSS, and unhandled trace leakages.
- Type assertions like `as any` represent implicit risks that can bypass static analysis and lead to silent failures. Swapping them with precise Zod validations or strict generic interfaces keeps boundaries bulletproof.

### 3. ACTION PLAN & IMPLEMENTATION
- **API Security (Spec 052)**: Applied `secureHeaders()` globally, added in-memory rate limiting with customizable route windows, restricted CORS to configured origins, and implemented a safe error wrapper returning structured JSON. Verified via `packages/testing/src/api-security.test.ts`.
- **Monolith Decomposition (Specs 053, 054, 055, 058, 062, 063)**: Successfully split Hono route monoliths (sequences, opportunities, service, leads) and core shared utilities (`packages/core/src/domain/shared/index.ts`) into single-responsibility sub-packages.
- **Observability & Logging (Specs 059, 060)**: Integrated Pine structured logs within embedding pipeline and addressed silent exceptions handling in sales-ops.
- **Type Safety & Runtime Security (Specs 056, 057)**: Replaced unsafe type assertion casts with Zod typing, and patched monorepo baseline to Node 22.22.3.
- **Shared Domain Validation tests (Spec 061)**: Added a comprehensive suite under `packages/testing/src/shared-domain-utils.test.ts`.

### 4. VERIFICATION LOG
- Ran linter, formatter, and type-checks: `pnpm verify` (100% successful with exit code 0).
- Ran entire test suite: `pnpm test` (all 150 test files, 511 tests passed 100% green and regression-free).

## [2026-05-30] Cycle 9 — Reciprocal Rank Fusion (RRF) Hybrid Search (Spec 064)

### 1. REPO BASELINE
- **Branch**: `main`, active work in progress.
- **Verification Command**: `pnpm run agent:check`
- **Test Baseline**: 151 passed test files, 517 passed tests. All green.

### 2. ARCHITECTURAL FINDINGS
- A unified search endpoint combines fuzzy keyword search and vector cosine semantic search.
- Reciprocal Rank Fusion (RRF) with constant $k = 60$ provides an elegant, non-normalized sorting metric that automatically prioritizes records matched by both methods (high consensus).
- A Hono routing conflict was identified where a wildcard route `GET /:id` in the lead CRUD router swallowed more specific lead routers' subpaths (like `/auto-conversion-rules` or `/sla` targets) mounted after it, returning a 404. Reordering route mounting resolved all issues.
- Missing `await` on asynchronous `dbStore.clear()` database truncation queries during test setups caused concurrent Postgres tables to wipe out during test insertions (race condition), which was resolved by ensuring the promise is properly awaited.

### 3. ACTION PLAN & IMPLEMENTATION
- **Hybrid Search (Spec 064)**:
  - Implemented `globalHybridSearch` in `packages/search/src/index.ts` with default $k = 60$ Reciprocal Rank Fusion scoring.
  - Exposed Hono API endpoint `GET /api/productivity/search/hybrid` (also mounted as `/api/search/hybrid` on Hono routers).
  - Created `packages/testing/src/hybrid-search.test.ts` to test lexical, semantic, consensus ranking, and tenant context isolation.
  - Set custom 60,000ms Vitest hook timeout to prevent parallel test container setup timeouts.
  - Cleaned up unused `tokenTenantB` variables to ensure Biome linter is completely warning-free.

### 4. VERIFICATION LOG
- Executed whole workspace verification check: `pnpm run agent:check` (completed successfully with exit status 0).
- All 151 test files and 517 tests passed cleanly and regression-free.





