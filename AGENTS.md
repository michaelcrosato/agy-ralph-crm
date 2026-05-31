# AGENTS.md - Canonical Agent Instructions

Last updated: 2026-05-31

This repo is a production-sensitive, multi-tenant agency CRM with Ralph AI surfaces. Autonomous agents may make bounded local changes, but tenant isolation, RBAC, RLS, auditability, PII safety, and mock outbound behavior are non-negotiable.

## Read-First Order

1. `AGENTS.md`
2. `plan/GOAL.md`
3. Root `GOAL.md`
4. `plan/ROADMAP.md`
5. `docs/ai/REPO_MAP.md`
6. `plan/PROGRESS.md`
7. Lowest-numbered unblocked `tickets/TICKET*.md`
8. Matching `.ralph/specs/*` or `plan/specs/*`

Do not blind-scan the repo. Use the map, `.aiignore`, and targeted `rg`.

## Canonical Loop

1. Audit: run `git status --short --branch` first. Identify user-owned changes and do not overwrite them.
2. Research: read only the files needed for the ticket/spec and the relevant route/domain/store/test surfaces.
3. Plan: choose the smallest reversible change that satisfies the active spec.
4. Implement: edit locally, keep behavior tenant-safe, and add focused tests when behavior changes.
5. Verify: run targeted checks first, then broad gates when practical.
6. Document: update the ticket/spec/readiness docs with exact command outcomes and follow-ups.
7. Stop or hand off: do not run an infinite loop unless explicitly requested.

## Commands

- Status: `pnpm run agent:status`
- Doctor: `pnpm run agent:doctor`
- Full local gate: `pnpm run agent:check`
- Build/typecheck: `pnpm build` or `pnpm run agent:typecheck`
- Unit/integration tests: `pnpm test` or `pnpm run agent:test`
- E2E: `pnpm test:e2e` or `pnpm run agent:test:e2e`
- Lint/format: `pnpm run agent:lint`, `pnpm run agent:format`
- Targeted tests: `pnpm exec vitest run <test-file>`

The authoritative runtime target is root `package.json`: Node `>=22.22.3 <23`, pnpm `>=11.1.2 <12`. Node 24 may run commands but produces unsupported-engine warnings and is not the loop baseline.

## Hard Safety Rules

- No remote push, deployment, production DB access, or paid-service setup unless a human explicitly asks.
- Never weaken `tenantAuth`, RBAC, `withTenant`, `getActiveOrgId`, `assertTenantOwns`, RLS policies, or tenant-scoped store filters to pass tests.
- Do not read, print, seed, or commit real customer PII. Use synthetic data only.
- `.env.example` must contain placeholders or mock-safe defaults only. Never commit real secrets.
- Email, SMS, webhooks, billing, and AI-provider work must be mocked during unattended execution. If a live endpoint is required, stop that task and file a ticket/spec.
- Migrations must be additive and reversible. Use ephemeral/test DBs only. Never drop/truncate core tenant tables outside a test harness.
- Delete files only when they are confirmed obsolete or duplicates. Prefer soft-delete semantics for new user-facing records.

## Architecture Boundaries

- `packages/core` is domain logic. It must not import from `apps/*`, `modules/*`, customer forks, or UI/runtime composition code.
- `apps/api` is the Hono/OpenAPI composition root. Protected routes must apply `tenantAuth` and resource RBAC before data access.
- `packages/db` owns Drizzle schema, mock stores, PostgreSQL store parity, tenant context, and RLS guards.
- `packages/auth` owns session token and permission primitives.
- `packages/webhooks` must stay outbox/simulation backed unless an explicit integration ticket adds a real provider with skip/fail gates.
- `modules/*` are isolated extension seams. Customer-specific behavior should prefer tenant config, metadata/custom objects, or isolated modules over core changes.

## Current High-Priority Context

- The worktree may contain in-progress TICKET018 accounts-route split files. Treat those edits as user-owned unless you are explicitly working that ticket.
- Route/domain modularity work must preserve middleware order, Hono RPC inference, OpenAPI schema exports, and existing RLS/RBAC tests.
- Large files above the `ralph.yml` 400-line budget are not automatically work items. Split only by real responsibility and active spec.

## Definition of Done

- `git status` was checked before edits and reviewed after edits.
- The active ticket/spec has exact verification results.
- Touched code has targeted tests or a documented reason no test applies.
- Broad gate status is known: `pnpm run agent:check`, or specific skipped/failed subcommands are recorded.
- No tenant isolation, PII, outbound mock, migration, or secret-handling invariant regressed.
