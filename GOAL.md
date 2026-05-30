# SYSTEM ARCHITECTURE MASTER PLAN: GOAL & PURPOSE (GOAL.md)

**Repository:** `michaelcrosato/agy-ralph-crm`  
**Orchestration Target:** Ralph v2.9.3  
**System Status:** Active specs and backlog tasks complete; CRM core stabilized; AFK-ready  
**Date of Record:** May 30, 2026

---

## 1. Executive Purpose

This repository is a modular, multi-tenant CRM operating system built for autonomous AI-assisted engineering, strict tenant isolation, and production-grade CRM primitives. It is not a narrow CRUD application. It is a composable CRM foundation with a pure relational core, an API-first runtime, tenant-scoped stores, no-code metadata, marketing automation, service/ticketing, reporting, forecasting, and AFK-safe agent tooling.

The target end state is a self-maintaining CRM codebase where future specs can be claimed, implemented, verified, documented, and closed by AI agents without corrupting core architecture boundaries or leaking tenant data.

---

## 2. Current Recorded State

### 2.1 Active Backlog

All active ticket files currently present in `tickets/` are recorded as completed.

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

No `TICKET010.md` is currently present. New work must start as a new ticket and, when implementation is required, a matching structured spec under `.ralph/specs/`.

### 2.2 Reconciliation Note

Older documentation described TICKET009 as pending. The ticket file records TICKET009 as completed. This GOAL document treats TICKET009 as completed and separates future roadmap candidates from active backlog obligations.

### 2.3 Verification Posture

The active tickets record their acceptance criteria as satisfied. Future agents must still rerun verification after any code change. Historical completion is not a substitute for fresh verification of new edits.

```bash
pnpm build
pnpm run agent:lint
pnpm test
pnpm verify
pnpm test:e2e
```

---

## 3. Product Goal

The product goal is to provide a CRM foundation that can extend across five major lanes without rewriting the core:

| Lane | Goal |
| --- | --- |
| Sales CRM | Accounts, contacts, leads, opportunities, products, pricebooks, quotas, commissions, territories, contracts, renewals, campaign influence, and pipeline health |
| Marketing CRM | Email templates, sequences, enrollment, tracking, opens, clicks, replies, bounces, unsubscribes, read-time events, suppressions, exclusions, split tests, and automation actions |
| Service CRM | Tickets, comments, tags, macros, assignment rules, escalations, milestones, SLA policies, knowledge-base primitives, service-lite modules, and MCP access |
| Metadata CRM | Custom fields, layouts, validation rules, picklist dependencies, custom objects, and custom records without runtime tenant-specific SQL migrations |
| Agentic Engineering | Specs, tickets, deterministic checks, line budgets, repo maps, and AFK tooling for autonomous coding agents |

---

## 4. Architecture Principles

### 4.1 Core Isolation

`packages/core` is the pure domain engine. It must not import from `apps/*`, `modules/*`, or customer-specific extension surfaces.

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

### 4.2 Metadata Over Forking

Tenant-specific behavior must be expressed through metadata whenever possible: `field_definitions`, `layout_definitions`, `validation_rules`, `picklist_dependencies`, `custom_entity_types`, `custom_entity_records`, workflows, sequence definitions, service rules, and macros. The core schema must not be mutated for one customer variant.

### 4.3 Tenant Boundary First

The organization context is the first-class security boundary. Primary mechanisms are:

- `withTenant(orgId, db, run)` for tenant-scoped execution.
- `tenantStorage` through `AsyncLocalStorage`.
- `SET LOCAL app.current_org_id` or `set_config('app.current_org_id', ...)` for database RLS context.
- `assertTenantOwns(entity)` for application-level ownership checks.
- `tenantAuth` for API route tenant binding.

---

## 5. Repository Topology

| Area | Purpose |
| --- | --- |
| `apps/api` | Hono/OpenAPI API surface, route composition, tenant middleware, public email tracking routes, docs route |
| `apps/web` | Next.js dashboard shell for tenant switching, lead/contact/opportunity views, search, and conversion UX |
| `packages/core` | Pure CRM domain logic, sequence execution, scoring, conversions, service calculations, validation helpers |
| `packages/db` | Drizzle schema, mock-backed stores, PostgreSQL adapter, tenant context, RLS assertion helpers |
| `packages/auth` | Session and permission primitives |
| `packages/audit` | Audit trail primitives and tenant-safe logging concepts |
| `packages/metadata` | Custom fields, layouts, picklists, validation, `defineObject()` custom object SDK |
| `packages/workflow` | Event-condition-action workflow execution |
| `packages/reporting` | Report definitions and scheduled report runtime |
| `packages/forecasting` | Forecast categories, quotas, weighted summaries, manager adjustments |
| `packages/webhooks` | Outbound webhooks, outbox, delivery records, dead-letter queue patterns |
| `packages/documents` | Templates and merge primitives |
| `packages/search` | Fuzzy and hybrid search helpers |
| `packages/ui` | Shared UI building blocks |
| `packages/testing` | Vitest integration and regression suites |
| `modules/service-lite` | Ticketing/service module and MCP-compatible service access |
| `scripts/agent` | Bootstrap, doctor, status, check, lint, format, typecheck, test, E2E, log rotation |
| `tickets` | Atomic backlog records and task completion ledger |
| `.ralph/specs` | Structured agent specs archive |

---

## 6. CRM Feature Inventory

| Domain | Current Capabilities |
| --- | --- |
| Identity and tenancy | Organizations, users, roles, memberships, tenant-authenticated routes, tenant-scoped stores, active organization context, RLS assertions, audit linkage |
| Accounts | Ownership, domains, parent account hierarchy, custom attributes, account teams, account-linked opportunities and contacts |
| Contacts | Account linkage, owner, email, reporting hierarchy, custom attributes, consent preferences, email/calendar sync targets |
| Leads | Create/list/read/update, custom-field validation, picklist dependency validation, validation rules, duplicate detection, merge, scoring, assignment, auto-conversion, SLA tracking, breach response |
| Opportunities | Stages, amount, close date, account/campaign linkage, products, teams, contact roles, competitors, approvals, stage history, stage guidance, stage gates, stalled-stage rules |
| Sales operations | Territories, quotas, leaderboards, commissions, forecast mappings, forecast adjustments, currency conversion fields |
| Campaigns | Campaign records, members, ROI calculations, influence attribution, segments, unsubscribe analytics |
| Products and billing | Products, pricebooks, pricebook entries, opportunity products, product schedules, contracts, subscriptions, invoices |
| Activities | Email, task, SMS, call, system notification, activity links, audit logs, timeline-style automation outputs |
| Marketing sequences | Email/task/SMS/call/webhook steps, pending execution, snooze/resume, sending windows, timezone handling, daily send limits, domain throttles, recipient caps, suppressions, exclusions, goals, conversions, exit triggers, branching |
| Sequence testing and optimization | A/B split allocation, automatic winner promotion, analytics summaries, recipient engagement scoring, sequence member logs |
| Email engagement | Email logging, trackers, open pixel, click redirect, replies, bounce/complaint events, read-time events, public unsubscribe, unsubscribe reasons, engagement recalculation |
| Custom metadata | Field definitions, layouts, validation rules, picklist dependencies, strict write-time checks |
| Custom objects | `defineObject()` SDK, object spec validation, custom entity types, custom entity records, strict record schemas, `/api/custom/:typeName` CRUD |
| Workflows and webhooks | ECA workflows, outbound webhooks, delivery logs, outbox, dead-letter queue, triggered webhook events |
| Reporting and analytics | Dashboard lead analytics, reports, scheduled report runs, campaign metrics, sequence metrics, unsubscribe/link/open/reply/bounce/read-time analytics |
| Service and tickets | Tickets, comments, tags, tag links, assignment rules, escalation rules, escalation records, macros, milestones, SLA policy concepts, knowledge-base primitives |
| MCP and modules | `modules/service-lite` provides service extension structure and MCP-compatible access while keeping core decoupled |
| Observability | API boot observability, OTel initialization, structured logger creation, sequence memory telemetry checks, diagnostics log rotation |
| Web app | Tenant switcher, live API mode, fallback mock mode, core entity panels, lead conversion UI, fuzzy search UX |

---

## 7. Marketing Sequence Engine Detail

The current sequence engine is one of the deepest completed subsystems. It supports step types `email`, `task`, `sms`, `call`, and `webhook`. The execution path handles due memberships, snoozed membership resume, sending-window deferral, timezone-aware scheduling, sequence-level daily limits, domain throttle checks, recipient frequency caps, suppression/exclusion checks, goal conversion checks, branch resolution, exit triggers, consent opt-outs, and step-handler dispatch.

The former monolith has been decomposed into named handlers for email, task, SMS, call, webhook, and branch behavior. Call steps create personalized call activities, link those activities to lead/contact targets, and advance sequence membership. Email steps handle template compilation, sender resolution, reply-thread subject behavior, tracker generation, A/B allocation, and winner promotion.

---

## 8. Custom Object System Detail

The no-code object layer allows tenant-defined object schemas without tenant-specific SQL migrations. `defineObject()` validates object names, field names, duplicate fields, field types, picklist options, lookup requirements, and strict record shape. Supported field types are `string`, `number`, `boolean`, `date`, `lookup`, `picklist`, `multi_picklist`, and `rich_text`.

Custom object data is stored through shared `custom_entity_types` and `custom_entity_records` tables. The REST layer exposes tenant-authenticated CRUD under `/api/custom/:typeName` and validates incoming records against the compiled object definition before persistence.

---

## 9. API Surface Summary

The API application composes route modules for health, auth, dashboard, public endpoints, MCP, metadata, custom objects, workflows, tickets, service, lead conversions, currencies, stage guidance, stage gates, leads, lead assignment, lead scoring, accounts, contacts, opportunities, campaigns, segments, unsubscribes, products, pricebooks, approvals, sequences, emails, public email tracking, territories, commissions, quotas, admin, database, imports, reports, leaderboards, forecasts, forecasting, contracts, documents, invoices, subscriptions, activities, webhooks, search, consent, productivity, and sales.

The API publishes OpenAPI metadata at `/openapi.json` and an API reference route at `/docs`.

---

## 10. Agent Operating Model

Agents must read `AGENTS.md`, `GOAL.md`, `ROADMAP.md`, `docs/ai/REPO_MAP.md`, the lowest-numbered active ticket if one exists, and the matching `.ralph/specs/` directory when implementation is required.

Agent work loop:

1. Inspect status and avoid overwriting unrelated local work.
2. Read applicable docs, ticket, and spec.
3. Make the smallest complete change.
4. Add or update targeted tests.
5. Run targeted checks.
6. Run broad verification.
7. Update ticket status and notes.
8. Update docs when scope, features, API surface, or roadmap state changed.
9. Summarize changed files, commands, and next best ticket.

Proceed autonomously for docs, tests, bug fixes, spec-tied features, scripts, and behavior-preserving refactors. Stop and ask for paid/external credentials, production deployment, legal/security ambiguity, destructive production database operations, or actions that could delete or expose real customer data.

---

## 11. Runtime and Tooling Constraints

| Constraint | Rule |
| --- | --- |
| Runtime | Node 22; root `package.json#engines` is authoritative |
| Package manager | pnpm; root `packageManager` is authoritative |
| Workspace | Turborepo over `apps/*`, `packages/*`, and `modules/*` |
| TypeScript | Strict compilation; no unsafe placeholder implementations |
| Formatting and linting | Biome is authoritative |
| File budget | Follow `ralph.yml` standard file-line budget unless explicitly justified |
| Context budget | Follow `ralph.yml` token budget and avoid blind scanning |
| Core boundary | No direct app/module/customer imports from `packages/core` |
| Tenant safety | No data operation may bypass tenant context intentionally |
| Logs | Large diagnostic logs must be sanitized/rotated through agent tooling |

---

## 12. Definition of Done

A task is complete only when its ticket and spec requirements are satisfied, core tenant isolation remains intact, new behavior is covered by targeted tests, TypeScript build succeeds, Biome checks pass, unit/integration tests pass, optional E2E passes or cleanly skips, documentation is updated when behavior or architecture changes, no unresolved RLS/security/data-leak concern remains, and the ticket is updated to `completed` with verification notes.

---

## 13. Non-Goals

This repository must not become a visual styling playground inside pure core packages, embed single-tenant customer behavior in shared domain logic, bypass tenant context for convenience, use runtime `eval` or unsafe dynamic execution for business logic, treat mock-store behavior as permission to weaken future PostgreSQL RLS behavior, add provider dependencies without explicit specs, or replace metadata extensibility with schema forks.

---

## 14. Future Roadmap Candidates

There is no active backlog after TICKET009. The following are candidate directions only. Each requires a new ticket and structured spec before implementation.

| Candidate | Purpose |
| --- | --- |
| Production PostgreSQL hardening | Verify mock-store parity against real PostgreSQL migrations and RLS policies |
| Deep RBAC | Expand permissions beyond tenant identity into role/action/resource policy checks |
| Web UI depth | Add richer UI flows for sequences, custom objects, dashboards, tickets, and reports |
| Provider integrations | Connect real email, calendar, SMS, webhook retry, and e-signature providers |
| Data operations | Add import/export UX, dedupe jobs, migration dashboards, and admin recovery tools |
| Observability | Expand OTel dashboards, structured logs, performance budgets, and runtime alerts |
| E2E coverage | Add Playwright journeys for key tenant, lead, sequence, ticket, and custom-object flows |
| AI orchestration governance | Add safeguards for multi-agent task claiming, spec locking, and evidence capture |
| Production deployment | Define environment, secrets, database, CI/CD, rollback, and backup standards |

Future candidates are not considered incomplete work. They become active only when a ticket and spec are created.

---

## 15. Final System Intent

The intended system is an AFK-ready CRM foundation where autonomous agents can safely extend a deeply modular, tenant-isolated platform. The repository should continue to prioritize tenant safety over convenience, metadata over forks, small modules over monoliths, verified behavior over optimistic claims, documentation parity with code, and clear tickets/specs over loose prompts.