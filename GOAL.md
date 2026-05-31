# SYSTEM ARCHITECTURE MASTER PLAN — MODULAR CRM CORE (GOAL.md)

**Repository:** `michaelcrosato/agy-ralph-crm`  
**System Type:** TypeScript modular CRM monorepo · pnpm workspaces · Turborepo · Hono API · Next.js web shell  
**Orchestration Target:** Ralph v2.9.3  
**Runtime Baseline:** root `package.json#engines` is authoritative (`node >=22.22.0 <23`, `pnpm >=11.1.2 <12`)  
**System Status:** v1.0 foundation recorded complete; active ticket ledger closed; fresh verification required before every new merge  
**Date of Record:** May 30, 2026

---

## 0. TL;DR

This repository is the architectural source of truth for a multi-tenant CRM operating system designed to be extended by autonomous AI coding agents without corrupting the core product boundary.

It is not a one-off CRUD app, a Salesforce clone, or a customer-specific fork. It is a modular CRM foundation: a pure relational domain core, a tenant-scoped persistence layer, a Hono/OpenAPI API runtime, a Next.js dashboard shell, no-code metadata/custom-object seams, marketing automation, sales operations, service/ticketing, reporting/forecasting, search/embedding seams, observability, and deterministic agent tooling.

All currently present active tickets are recorded as completed. That historical status is not a waiver: every future change must rerun the repo verification gate and update docs/tickets when behavior changes.

---

## 1. Mission

Build and maintain a clean, modular CRM operating system with a narrow, stable core and explicit extension seams, optimized for AI-agent execution, strict tenant isolation, and evidence-driven verification.

Human operators provide architecture, security, product, and verification gates. Agents may autonomously perform bounded code, test, documentation, and ticket work when a ticket/spec exists and no credential, legal, production, or destructive-data boundary is crossed.

---

## 2. Evidence and Truth Policy

This document is grounded in the live repository first. Drafts, prompts, summaries, previous agent claims, and generated markdown are evidence to reconcile, not instructions to copy.

### 2.1 Adopted from the consolidated draft

The following concepts are retained because they improve the goal document and are compatible with the repository:

- A clearer mission statement.
- A source-of-truth framing for `GOAL.md`.
- The customization hierarchy: tenant config → metadata/custom objects → first-party module → isolated customer module → customer fork only as a last resort.
- Stronger do-not-regress invariants.
- A future roadmap lane for semantic memory, async decoupling, production hardening, UI depth, and agent governance.

### 2.2 Not adopted as current fact

The following are not treated as current repository facts unless later implemented and verified:

- `apps/worker`, `bench/`, `infra/`, global `e2e/`, or `packages/testing` Testcontainers as active current topology.
- `Auth.js`, Tailwind/shadcn, BullMQ/Redis, `ralph-bench`, `pnpm check:boundaries`, `pnpm check:docs`, or bare `pnpm typecheck`/`pnpm lint` as current repo commands.
- `modules/email-calendar-sync`, `send-and-log-email`, `quotes-lite`, `campaign-lite`, or `approvals-lite` as shipped modules.
- A branch policy that agents cannot write to `main`; the repo-level operational source for that is `AGENTS.md` and platform protection, not this file.
- Full production PostgreSQL RLS policy parity. The repo contains tenant-context and mock/pg hooks; production RLS hardening remains a roadmap candidate.

### 2.3 Conflict resolution

The earlier draft listed territories, commissions, and multi-currency as non-goals. The live repository already contains sales-ops and currency surfaces. Therefore they are treated as current or partially implemented CRM capabilities, not forbidden domains. Expanded enterprise CPQ, ERP-specific workflows, industry objects, field service, telephony, and partner portals remain outside the core foundation unless a future ticket/spec explicitly admits them.

---

## 3. Current Recorded State

### 3.1 Active backlog

All ticket files currently present in `tickets/` are recorded as completed.

| Ticket | Status | Completed Scope |
| --- | --- | --- |
| TICKET001 | completed | Workspace bootstrap and dependency diagnostics |
| TICKET002 | completed | Cross-platform agent utility scripts |
| TICKET003 | completed | Marketing sequence Call actions and regression fixes |
| TICKET004 | completed | Dashboard lead analytics API |
| TICKET005 | completed | Lead SLA breach notification service |
| TICKET006 | completed | Dynamic picklist dependency validation |
| TICKET007 | completed | Sequence execution monolith decomposition |
| TICKET008 | completed | Public `defineObject()` SDK and custom objects |
| TICKET009 | completed | Diagnostic log sanitizer and workspace log rotator |
| TICKET010 | completed | Workspace diagnostic preflight and health checks |
| TICKET011 | completed | API and Packages core decomposition and split |
| TICKET012 | completed | Deep RBAC (Role-Based Access Control) Enforcement Middleware |
| TICKET013 | completed | OpenTelemetry Grafana Observability Dashboard |
| TICKET014 | completed | OpenAPI SDK client generation and Next.js integration |
| TICKET015 | completed | Conversational AI lead qualification bot integration |
| TICKET016 | completed | Next.js Leads BANT Analytics dashboard & Conversation Simulator |

No `TICKET017.md` is currently present. New implementation work must start with a new ticket and, when code behavior changes, a matching structured spec under `.ralph/specs/`.

### 3.2 Verification posture

The ticket ledger records acceptance criteria as satisfied. Future agents must still rerun verification after any change.

```bash
pnpm build
pnpm run agent:lint
pnpm test
pnpm verify
pnpm test:e2e
```

`pnpm run agent:check` is the preferred broad AFK command when a single command is desired.

---

## 4. Product Strategy

The product goal is to provide a CRM foundation that can extend across five lanes without rewriting the core.

| Lane | Goal |
| --- | --- |
| Sales CRM | Accounts, contacts, leads, opportunities, products, pricebooks, quotas, commissions, territories, contracts, renewals, campaign influence, and pipeline health |
| Marketing CRM | Email templates, sequences, enrollment, tracking, opens, clicks, replies, bounces, read-time events, unsubscribes, suppressions, exclusions, split tests, and automation actions |
| Service CRM | Tickets, comments, tags, macros, assignment rules, escalations, milestones, SLA concepts, knowledge-base primitives, service-lite module surfaces, and MCP access |
| Metadata CRM | Custom fields, layouts, validation rules, picklist dependencies, custom objects, and custom records without tenant-specific SQL migrations |
| Agentic Engineering | Specs, tickets, deterministic checks, line budgets, repo maps, AFK scripts, diagnostics, and log hygiene for autonomous coding agents |

---

## 5. Customization Hierarchy

Every customer-specific request must be resolved at the lowest viable tier. Escalate only when the lower tier cannot satisfy the requirement.

1. **Tenant config** — Can it be toggled or configured without schema/code changes?
2. **Metadata** — Can it be represented through custom JSONB fields, layouts, validation rules, picklist dependencies, sequence definitions, workflows, or custom objects?
3. **First-party module** — Can an isolated shipped module handle it without changing `packages/core`?
4. **Customer module** — Can an isolated module under `modules/*` satisfy it through explicit interfaces?
5. **Customer branch/fork** — Last resort only; must not mutate shared core for a single tenant.

Core schema/code changes are justified only when the capability is generic, repeatable, tenant-safe, and backed by a ticket/spec/test plan.

---

## 6. Architecture Principles

### 6.1 Core isolation

`packages/core` is the domain engine. It must not import from `apps/*`, `modules/*`, `extensions/*`, or customer-specific implementation surfaces.

Allowed dependency direction:

```text
apps/*            -> packages/*
modules/*         -> packages/*
packages/core     -> packages/db, packages/search, packages/observability
packages/db       -> schema, stores, tenant context, mock/pg adapters
packages/metadata -> validation and schema-definition helpers
```

Forbidden direction:

```text
packages/core -> apps/*
packages/core -> modules/*
packages/core -> extensions/*
packages/core -> customer-specific implementation code
```

### 6.2 Metadata over forks

Tenant-specific behavior should be expressed through metadata whenever possible: `field_definitions`, `layout_definitions`, `validation_rules`, `picklist_dependencies`, `custom_entity_types`, `custom_entity_records`, workflows, sequences, service rules, macros, and module configuration.

### 6.3 Tenant boundary first

The organization context is the first-class security boundary. Primary mechanisms are:

- `withTenant(orgId, db, run)` for tenant-scoped execution.
- `tenantStorage` through `AsyncLocalStorage`.
- `SET LOCAL app.current_org_id` or `set_config('app.current_org_id', ...)` for database RLS context.
- `assertTenantOwns(entity)` for application-level ownership checks.
- `tenantAuth` for API route tenant binding.

### 6.4 Explicit primitives

Prefer small, typed, boring modules over clever abstractions. A smaller reasoning surface improves autonomous coding accuracy and reduces token waste.

---

## 7. Repository Topology

| Area | Purpose |
| --- | --- |
| `apps/api` | Hono/OpenAPI API surface, route composition, tenant middleware, public email tracking routes, API reference route |
| `apps/web` | Next.js dashboard shell for tenant switching, lead/contact/opportunity panels, fuzzy search, and lead conversion UX |
| `packages/core` | Pure CRM domain logic, sequence execution, scoring, conversions, service calculations, embedding queue, validation helpers |
| `packages/db` | Drizzle schema, mock-backed stores, PostgreSQL adapter, tenant context, RLS assertion helpers |
| `packages/api-client` | Hono-based typed API client surface for the web app |
| `packages/auth` | Session and permission primitives |
| `packages/audit` | Audit trail primitives and tenant-safe logging concepts |
| `packages/metadata` | Custom fields, layouts, picklists, validation, and `defineObject()` custom object SDK |
| `packages/workflow` | Event-condition-action workflow execution |
| `packages/reporting` | Report definitions and scheduled report runtime |
| `packages/forecasting` | Forecast categories, quotas, weighted summaries, manager adjustments |
| `packages/webhooks` | Outbound webhooks, outbox, delivery records, dead-letter queue patterns |
| `packages/documents` | Document templates and merge primitives |
| `packages/search` | Trigram, Levenshtein, hybrid fuzzy search, and embedding provider utilities |
| `packages/mcp` | Model Context Protocol package surface using the same tenant/auth concepts |
| `packages/ui` | Shared UI building blocks |
| `packages/testing` | Vitest integration and regression suites |
| `modules/service-lite` | Ticketing/service module and MCP-compatible service access |
| `modules/_template` | Scaffold for future isolated modules |
| `scripts/agent` | Bootstrap, doctor, status, check, lint, format, typecheck, test, E2E, and log rotation commands |
| `tickets` | Atomic backlog records and task completion ledger |
| `.ralph/specs` | Structured agent specs archive |
| `docs/ai/REPO_MAP.md` | Agent navigation map and current repo topology |

---

## 8. Current Stack

| Layer | Current Repo Evidence |
| --- | --- |
| Runtime | Node `>=22.22.0 <23`; Node 22 branch remains the repo target |
| Package manager | `pnpm@11.1.2` via root `packageManager` |
| Monorepo | pnpm workspace over `apps/*`, `packages/*`, `modules/*`; Turbo commands at root |
| API | Hono, `@hono/node-server`, `@hono/zod-openapi`, Scalar API reference |
| Web | Next.js 16, React 19, `@crm/api-client` |
| Database | Drizzle ORM schemas plus mock store and PostgreSQL adapter path |
| Validation | Zod and metadata validators |
| Formatting/linting | Biome |
| Testing | Vitest; Playwright E2E command exists and may cleanly skip when no config is present |
| MCP | `@modelcontextprotocol/sdk` through `packages/mcp` and API MCP routes |
| Search/AI seam | Trigram/Levenshtein fuzzy search, mock/OpenAI embedding provider seam, 1536-dimension embedding table |
| Observability | OTel bootstrap and logger initialization in API startup, memory telemetry checks in sequence execution, diagnostic log rotation |

---

## 9. Core Domain and Data Model

The relational model is fixed for primitive tables. Per-tenant custom fields are stored in managed JSONB/custom metadata paths rather than customer-specific schema forks.

Core relational spine:

```text
organizations
users
roles
memberships
accounts
contacts
leads
opportunities
activities
activity_links
audit_logs
field_definitions
layout_definitions
validation_rules
picklist_dependencies
custom_entity_types
custom_entity_records
```

Extended CRM surfaces include campaigns, campaign members, products, pricebooks, opportunity products, product schedules, contracts, subscriptions, invoices, quotas, commissions, territories, forecasting, approvals, stage gates, stage guidance, tickets, macros, ticket assignment/escalation rules, lead SLA targets/trackers, email trackers/events, marketing sequence entities, webhooks, reports, documents, and embeddings.

---

## 10. Security Model

### 10.1 Required tenant behavior

Any tenant-owned record must be created, read, updated, deleted, aggregated, searched, reported, or embedded only inside the active tenant context.

Cross-tenant access must fail through application guards and, for production PostgreSQL, through database RLS. Mock-store tests must not be treated as permission to weaken production RLS.

### 10.2 RLS/session-context pattern

The intended PostgreSQL session context is `app.current_org_id`, set inside tenant-scoped execution and checked by RLS policies. Application-level `assertTenantOwns` remains a defense-in-depth guard.

### 10.3 Mandatory tenant test shape

Every new store, route, worker, workflow, report, search, or automation feature must include positive tenant tests and negative cross-tenant tests. Aggregations are especially risky and must prove that tenant B cannot see counts, metrics, activities, or derived outputs from tenant A.

---

## 11. CRM Feature Inventory

| Domain | Current Capabilities |
| --- | --- |
| Identity and tenancy | Organizations, users, roles, memberships, tenant-authenticated routes, tenant-scoped stores, active organization context, RLS assertions, audit linkage |
| Accounts | Ownership, domains, parent account hierarchy, custom attributes, account teams, account-linked opportunities and contacts |
| Contacts | Account linkage, owner, email, reporting hierarchy, custom attributes, consent preferences, email/calendar sync record concepts |
| Leads | Create/list/read/update, custom-field validation, picklist dependency validation, validation rules, duplicate detection, merge, scoring, assignment, auto-conversion, SLA tracking, breach response |
| Opportunities | Stages, amount, close date, account/campaign linkage, products, teams, contact roles, competitors, approvals, stage history, stage guidance, stage gates, stalled-stage rules |
| Sales operations | Territories, quotas, leaderboards, commissions, forecast mappings, forecast adjustments, currency conversion fields |
| Campaigns | Campaign records, members, ROI calculations, influence attribution, segments, unsubscribe analytics |
| Products and billing | Products, pricebooks, pricebook entries, opportunity products, product schedules, contracts, subscriptions, invoices |
| Activities | Email, task, SMS, call, system notification, activity links, audit logs, timeline-style automation outputs |
| Marketing sequences | Email/task/SMS/call/webhook steps, pending execution, snooze/resume, sending windows, timezone handling, daily send limits, domain throttles, recipient caps, suppressions, exclusions, goals, conversions, exit triggers, branching |
| Sequence optimization | A/B split allocation, automatic winner promotion, analytics summaries, recipient engagement scoring, sequence member logs |
| Email engagement | Email logging, trackers, open pixel, click redirect, replies, bounce/complaint events, read-time events, public unsubscribe, unsubscribe reasons, engagement recalculation |
| Custom metadata | Field definitions, layouts, validation rules, picklist dependencies, strict write-time checks |
| Custom objects | `defineObject()` SDK, object spec validation, custom entity types, custom entity records, strict record schemas, `/api/custom/:typeName` CRUD |
| Workflows and webhooks | ECA workflows, outbound webhooks, delivery logs, outbox, dead-letter queue, triggered webhook events |
| Reporting and analytics | Dashboard lead analytics, reports, scheduled report runs, campaign metrics, sequence metrics, unsubscribe/link/open/reply/bounce/read-time analytics |
| Service and tickets | Tickets, comments, tags, tag links, assignment rules, escalation rules, escalation records, macros, milestones, SLA policy concepts, knowledge-base primitives |
| MCP and modules | `packages/mcp` and `modules/service-lite` provide AI/service extension surfaces while keeping core decoupled |
| Search and embeddings | Hybrid fuzzy search, trigram index, Levenshtein matching, embedding provider seam, embedding persistence for account/contact mutations |
| Observability and hygiene | API boot observability, OTel initialization, structured logger creation, sequence memory telemetry checks, diagnostics log rotation/sanitization |
| Web app | Tenant switcher, live API mode, fallback mock mode, core entity panels, lead conversion UI, fuzzy search UX |

---

## 12. Deep Subsystem Notes

### 12.1 Marketing sequence engine

The sequence engine supports step types `email`, `task`, `sms`, `call`, and `webhook`. Execution handles due memberships, snoozed membership resume, sending-window deferral, timezone-aware scheduling, sequence-level daily limits, domain throttle checks, recipient frequency caps, suppression/exclusion checks, goal conversion checks, branch resolution, exit triggers, consent opt-outs, and step-handler dispatch.

The former monolith has been decomposed into handlers for email, task, SMS, call, webhook, and branch behavior. Call steps create personalized call activities, link those activities to lead/contact targets, and advance sequence membership. Email steps handle template compilation, sender resolution, reply-thread subject behavior, tracker generation, A/B allocation, and winner promotion.

### 12.2 Custom object system

The no-code object layer allows tenant-defined object schemas without tenant-specific SQL migrations. `defineObject()` validates object names, field names, duplicate fields, supported field types, picklist options, lookup requirements, and strict record shape.

Supported custom field types are `string`, `number`, `boolean`, `date`, `lookup`, `picklist`, `multi_picklist`, and `rich_text`.

Custom object data is stored through shared `custom_entity_types` and `custom_entity_records` tables. The REST layer exposes tenant-authenticated CRUD under `/api/custom/:typeName` and validates incoming records against the compiled object definition before persistence.

### 12.3 Search and embeddings

`packages/search` implements trigram and Levenshtein-style fuzzy search for CRM records. `packages/core` also contains an embedding service that can use a mock provider by default or OpenAI embeddings when explicitly configured with credentials. Embeddings are persisted under tenant context. Future semantic memory work should harden and productize this seam rather than bypassing it.

### 12.4 Service module

`modules/service-lite` is the current isolated service/ticketing module. Future service features must preserve module boundaries and avoid importing module-specific logic into `packages/core`.

---

## 13. API Surface Summary

The API application composes route modules for health, auth, dashboard, public endpoints, MCP, metadata, custom objects, workflows, tickets, service, lead conversions, currencies, stage guidance, stage gates, leads, lead assignment, lead scoring, accounts, contacts, opportunities, campaigns, segments, unsubscribes, products, pricebooks, approvals, sequences, emails, public email tracking, territories, commissions, quotas, admin, database, imports, reports, leaderboards, forecasts, forecasting, contracts, documents, invoices, subscriptions, activities, webhooks, search, consent, productivity, and sales.

The API publishes OpenAPI metadata at `/openapi.json` and an API reference route at `/docs`.

Do not claim a public tRPC surface as current unless a future implementation adds it. The current repo-visible API surface is Hono/OpenAPI plus the Hono-based API client package.

---

## 14. Agent Operating Model

Read-first order:

1. `AGENTS.md`
2. `GOAL.md`
3. `ROADMAP.md`
4. `docs/ai/REPO_MAP.md`
5. The lowest-numbered active ticket, if one exists
6. The matching `.ralph/specs/` directory, if implementation is required

Agent loop:

1. Inspect repo status and avoid overwriting unrelated local work.
2. Read applicable docs, ticket, and spec.
3. Make the smallest complete change.
4. Add or update targeted tests.
5. Run targeted checks.
6. Run broad verification.
7. Update ticket status and verification notes.
8. Update docs when scope, features, API surface, commands, or architecture changed.
9. Summarize changed files, verification commands, and next best ticket.

Proceed autonomously for docs, tests, bug fixes, spec-tied features, scripts, and behavior-preserving refactors. Stop and ask for paid/external credentials, production deployment, legal/security ambiguity, destructive production database operations, or actions that could delete or expose real customer data.

---

## 15. Definition of Done

A task is complete only when all of the following are true:

1. Ticket and spec requirements are satisfied.
2. Core tenant isolation remains intact.
3. New behavior has targeted tests, including negative tenant tests where relevant.
4. TypeScript build succeeds.
5. Biome/lint checks pass.
6. Unit/integration tests pass.
7. Optional E2E command passes or cleanly skips according to repo behavior.
8. Documentation is updated when behavior, commands, routes, architecture, or roadmap status changed.
9. No unresolved RLS/security/data-leak concern remains.
10. The ticket is updated to `completed` with verification notes.

Canonical broad checks:

```bash
pnpm build
pnpm run agent:lint
pnpm test
pnpm verify
pnpm test:e2e
```

---

## 16. Do-Not-Regress Invariants

1. No cross-tenant access, including derived outputs such as aggregates, analytics, reports, logs, search results, embeddings, or webhook payloads.
2. `packages/core` must not import from `apps/*`, `modules/*`, `extensions/*`, or customer-specific implementation surfaces.
3. Business/domain logic belongs in packages, not in Next.js UI handlers.
4. No placeholder implementations, fake TODO completions, or unverifiable success claims.
5. Standard files should stay within the `ralph.yml` line budget unless a ticket/spec justifies the exception.
6. New features must use metadata/module seams before core mutation.
7. Mock-store behavior must remain aligned with Drizzle schema and future PostgreSQL behavior.
8. Diagnostic logs must be sanitized and rotated when large or sensitive.
9. New provider integrations must stay behind interfaces and mocks until credentials and production policy are approved.
10. Documentation must match the code that exists, not the code the roadmap hopes to build.

---

## 17. Runtime and Tooling Constraints

| Constraint | Rule |
| --- | --- |
| Runtime | Root `package.json#engines` is authoritative |
| Package manager | Root `packageManager` is authoritative |
| Workspace | Turborepo over `apps/*`, `packages/*`, and `modules/*` |
| TypeScript | Strict compilation; no unsafe placeholder implementations |
| Formatting/linting | Biome is authoritative |
| File budget | Follow `ralph.yml` standard file-line budget unless explicitly justified |
| Context budget | Follow `ralph.yml` token budget and avoid blind scanning |
| Core boundary | No direct app/module/customer imports from `packages/core` |
| Tenant safety | No data operation may bypass tenant context intentionally |
| Logs | Large diagnostic logs must be sanitized/rotated through agent tooling |

---

## 18. Non-Goals

This repository must not become:

- A visual styling playground inside pure core packages.
- A fork-per-customer code swamp.
- A single-tenant CRM with tenant filters added later.
- A provider-coupled integration product without mocks and interfaces.
- A runtime `eval` or unsafe dynamic-execution system for business logic.
- A repository where roadmap candidates are documented as completed current features.

Explicitly outside the foundation unless admitted by future ticket/spec: enterprise CPQ, ERP-specific workflows, industry-object packs, partner portals, field service, telephony, and paid/credential-bound provider deployments.

---

## 19. Future Roadmap Candidates

There is no active backlog after TICKET009. The following are candidates only. Each requires a new ticket and structured spec before implementation.

| Candidate | Purpose |
| --- | --- |
| Baseline re-verification | Run and record `pnpm verify`, `pnpm test`, and `pnpm test:e2e` after this documentation update |
| Production PostgreSQL hardening | Verify mock-store parity against real PostgreSQL migrations and RLS policies |
| Deep RBAC | Expand permissions beyond tenant identity into role/action/resource policy checks |
| Semantic memory | Productize the existing embedding seam into tenant-safe semantic retrieval and account/contact intelligence |
| AI account summary | Add permission-scoped account summaries through an isolated module or API path |
| AI lead scoring | Add model-assisted scoring through metadata/module seams before core mutation |
| Async decoupling | Spec whether queue/worker infrastructure is needed for embeddings, sync, long-running providers, or AI jobs |
| Web UI depth | Add richer UI flows for sequences, custom objects, dashboards, tickets, and reports |
| Provider integrations | Connect real email, calendar, SMS, webhook retry, and e-signature providers behind interfaces and mocks |
| Data operations | Add import/export UX, dedupe jobs, migration dashboards, and admin recovery tools |
| Observability | Expand OTel dashboards, structured logs, performance budgets, and runtime alerts |
| E2E coverage | Add Playwright journeys for tenant, lead, sequence, ticket, and custom-object flows |
| Agent governance | Add safeguards for multi-agent task claiming, spec locking, and evidence capture |
| Production deployment | Define environment, secrets, database, CI/CD, rollback, health checks, backup, and deployment runbook |

Future candidates are not incomplete work. They become active only when a ticket and spec are created.

---

## 20. Immediate Next Directives

1. Create `TICKET010.md` only if there is a real next task to claim.
2. If the next task is verification-only, record exact command output and do not imply tests passed unless they were run.
3. If the next task is semantic memory, start with a spec that audits the existing embedding table, provider seam, tenant tests, search APIs, and credential boundaries.
4. If the next task is async decoupling, start with a spec that proves a worker/queue is necessary before adding infrastructure.
5. If the next task is UI expansion, keep domain logic in packages and route/API layers; UI must not become the source of business truth.

---

## 21. Glossary

| Term | Meaning |
| --- | --- |
| Ralph | Autonomous AI coding-agent loop target recorded by the repo |
| Hard Core | Generic CRM relational/domain spine that must not import app/module/customer code |
| First-Party Module | Isolated shipped module under `modules/*` or package equivalent |
| Metadata | Tenant-scoped configuration such as fields, layouts, validation, picklists, sequences, workflows, and custom object definitions |
| RLS | Row-Level Security; database-enforced tenant isolation goal/backstop |
| ECA | Event-Condition-Action workflow grammar |
| MCP | Model Context Protocol surface for AI tool access |
| DoD | Definition of Done; tests, verification, docs, ticket status, and security gates all satisfied |

---

## 22. Final System Intent

The intended system is an AFK-ready CRM foundation where autonomous agents can safely extend a deeply modular, tenant-isolated platform. The repository should continue to prioritize tenant safety over convenience, metadata over forks, small modules over monoliths, verified behavior over optimistic claims, documentation parity with code, and clear tickets/specs over loose prompts.