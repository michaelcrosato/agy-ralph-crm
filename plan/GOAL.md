# /plan/GOAL.md - One-Shot Readiness Goal

Date of record: 2026-05-31

## Purpose

Prepare `agy-ralph-crm` for a separate perpetual autonomous loop that can operate safely, repeatably, and with low context overhead. This file is operational guidance, not a replacement for the root architecture blueprint in `GOAL.md`.

The product is a production-sensitive, multi-tenant agency CRM with Ralph AI surfaces. Treat tenant isolation, RBAC, RLS, auditability, and PII safety as hard invariants.

## Current State

- Monorepo: pnpm workspaces and Turborepo over `apps/*`, `packages/*`, and `modules/*`.
- Runtime target: `package.json` requires Node `>=22.22.3 <23` and `pnpm >=11.1.2 <12`.
- Local observed runtime during readiness: Node `v24.15.0`, which triggers engine warnings. Use Node 22.22.x for loop execution.
- API entry point: `apps/api/src/index.ts`, Hono plus `@hono/zod-openapi`.
- Web entry point: `apps/web/src/app/page.tsx`, Next.js 16 / React 19 dashboard shell.
- Core domain: `packages/core/src/domain/*` plus exported public surface in `packages/core/src/index.ts`.
- Persistence: `packages/db/src/schema.ts`, `packages/db/src/stores/*`, `packages/db/src/_tenant.ts`, `packages/db/src/_rls.ts`.
- Auth/RBAC: `packages/auth/src/index.ts`, `apps/api/src/middleware/tenantAuth.ts`, `apps/api/src/middleware/rbac.ts`.
- Current worktree has an in-progress accounts route split: `tickets/TICKET018.md`, `.ralph/specs/0077-split-accounts-routes/`, and `apps/api/src/routes/accounts/`.

## End State

A perpetual loop can start by reading a small set of canonical files, choose one safe ticket, make a scoped change, run real checks, record outcomes, and stop or continue without weakening isolation, calling live external services, leaking PII, or touching production data.

## Non-Goals

- No remote push, deployment, or production database access.
- No paid-service setup or live provider calls from agent checks.
- No destructive migrations, table drops, truncation of non-test data, or tenant isolation shortcuts.
- No customer-specific forks or client-specific changes in shared core.
- No broad refactors unless a ticket/spec explicitly requires them.

## Constraints

- Tenant isolation is absolute. Do not bypass `tenantAuth`, `withTenant`, `assertTenantOwns`, or RBAC checks to make a build pass.
- Default data path is mock-backed. PostgreSQL runs must use ephemeral/test containers only.
- Outbound email, SMS, webhooks, billing, and AI-provider calls must stay mocked during unattended work. If a live endpoint is required, stop that task and file a ticket.
- Use synthetic data only. Do not read, print, or commit real customer PII.
- Migrations must be additive and reversible. Prefer soft-delete semantics for new user-facing records.
- Keep files under the `ralph.yml` budget unless the active split ticket explicitly covers a transition.

## Read-First Order

1. `AGENTS.md`
2. `plan/GOAL.md`
3. Root `GOAL.md`
4. `plan/ROADMAP.md`
5. `docs/ai/REPO_MAP.md`
6. `plan/PROGRESS.md`
7. Lowest-numbered unblocked `tickets/TICKET*.md`
8. Matching `.ralph/specs/*` or `plan/specs/*`

## Key Commands

```bash
pnpm run agent:status
pnpm run agent:doctor
pnpm run agent:check
pnpm verify
pnpm build
pnpm test
pnpm test:e2e
```

Use targeted checks before broad checks, for example:

```bash
pnpm exec vitest run packages/testing/src/tenant.test.ts
pnpm --filter @crm/auth build
pnpm exec biome check AGENTS.md plan/GOAL.md plan/ROADMAP.md .env.example
```

## Patterns

- API routes compose under `apps/api/src/index.ts`; route modules should keep `tenantAuth` and `resourceRbac` ahead of protected handlers.
- DB operations must run inside `withTenant(orgId, db, run)` or a route already wrapped by `tenantAuth`.
- Store methods must filter by active `orgId`; ID lookups that can cross tenants must return not found, not leaked metadata.
- Public intake routes are allowed only when they establish tenant context from a validated public object and never expose cross-tenant records.
- External integrations should write to outbox, activity, or mock logs. Live network dispatch belongs behind an explicit provider setting and a ticket.
- Logs and test artifacts must be sanitized with `scripts/agent/rotate-logs.mjs` before being preserved.

## Definition of Done

- `git status` was inspected first and no user-owned changes were overwritten.
- The active ticket/spec was updated or a follow-up was filed for any unresolved issue.
- Targeted tests for touched behavior ran and exited 0, or the failure is documented with exact command and next action.
- `pnpm run agent:check` or the narrowest defensible equivalent ran before handoff.
- `.env.example` contains no secrets and documents required mock-safe defaults.
- No protected invariant was weakened: tenant isolation, RBAC, RLS, PII safety, outbound mocking, additive migrations.
- No remote push was performed by the readiness or perpetual loop unless a human explicitly requested it.
