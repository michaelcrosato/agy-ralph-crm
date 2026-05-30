# SYSTEM ARCHITECTURE MASTER PLAN: GOAL & PURPOSE (GOAL.md)

**Orchestration Target:** Ralph v2.9.3
**System Status:** AFK-Ready CRM Core Features Stabilized & Verified
**Date of Record:** May 29, 2026

---

## 1. Executive Purpose & Scope

This codebase serves as the definitive multi-tenant CRM operating system designed for **100% autonomous AI execution**. The system is modularly separated to allow clean horizontal boundaries and zero human coding dependencies.

### Core Primitives
1. **Identity & Tenancy Isolation**: Org-level isolation context wrapped at the database layer (PostgreSQL Row-Level Security).
2. **Sales Fundamentals**: Accounts, Contacts, Leads, and Opportunities core primitives.
3. **Activity Timelines**: Logging and linking emails, tasks, SMS, and Calls.
4. **Marketing Automation**: Event-Condition-Action (ECA) grammar parsers, email trackers, and automated sequences supporting email, webhooks, tasks, SMS, and newly implemented Call steps.

---

## 2. Current State vs. Desired End State

### Current State
- Monorepo infrastructure initialized and fully stabilized under `pnpm` workspaces + `turbo`.
- 130 structural specification iterations developed and stored under `.ralph/specs/`.
- Phase 0 to Phase 5 fully stabilized. Recent **Marketing Sequence Call Actions (Task 0222)** successfully completed, including REST schema expansions, execute engine support, validation routing, and strict multi-tenant Vitest suites.
- All workspace checks compile perfectly without a single Biome error or Vitest regression.

### Desired End State
- A self-healing, AFK-ready codebase where incoming engineering specifications can be claimed, developed, and verified autonomously by parallelized Ralph sub-agents.
- Pure relational decoupling where no feature extension compromises multi-tenant security boundaries.

---

## 3. Non-Goals
- Never build visual styling dependencies directly inside the pure packages core logic.
- Avoid dynamic runtime code execution or untyped serialization (e.g. `eval` or unsupported Node 22 APIs).
- Never mutated standard database schemas for single-tenant customer variants; single-tenant customization is strictly barred from core and must reside inside metadata definitions or extensions.

---

## 4. Key Constraints & Safe Assumptions
- **Runtime Baseline**: Node.js v22.0.0 is the immutable target baseline.
- **Context Token Budget**: Standard workspace limits target `32,768` context tokens. Standard source files must be kept under `400` lines (see `ralph.yml`).
- **Safety Assumption**: Agents should proceed autonomously on all bugs, scripts, and code generation. Pause ONLY for external paid credentials, legal, or destructive database operations on production.

---

## 5. Centralized Agent Guidance

### 5.1 Read-First Order
Upon task instantiation, agents must follow this reading order:
1. `AGENTS.md` - Core loop, command references, and boundaries.
2. `GOAL.md` - System architecture, scope matrix, and desired end state.
3. `ROADMAP.md` - Phased implementation plans, risk maps, unblocked tickets.
4. `docs/ai/REPO_MAP.md` - Subdirectory mappings and entry points.
5. The highest-priority unblocked ticket in `tickets/` (for example `tickets/TICKET007.md`).

### 5.2 Key Commands
- **Workspace Verify Check**: `pnpm verify` (Runs compiler, lint, and Biome checks)
- **Workspace Build**: `pnpm build`
- **Run Unit & Integration Tests**: `pnpm test`
- **Run Specific Test**: `npx vitest run packages/testing/src/<test-name>.test.ts`
- **Format Code**: `npx biome check --write .`

### 5.3 Architectural Patterns to Follow
- Always enforce active multi-tenancy contexts via `withTenant(orgId, mockDb, ...)` wrappers.
- Add comprehensive integration tests in `packages/testing/src/` for every newly implemented schema property.
- Register newly added packages or modules inside the root `pnpm-workspace.yaml` and respective `package.json` configurations.

### 5.4 Anti-Patterns to Avoid
- **No placeholders**: Never write `// TODO: implement this` or similar. Write complete, robust production-ready code.
- **No direct mutations**: Never allow packages in `packages/core` to import any file from `modules/*`, `apps/*`, or `extensions/*`.
- **No blind scanning**: Use grep search patterns and REPO_MAP mappings to minimize context-token drift.

---

## 6. Definition of Done (DoD)
A task is marked completed and AFK-ready only when:
1. Type check compiles successfully without warning (`pnpm build` or `pnpm run agent:typecheck`).
2. Lint check passes cleanly with no warnings or errors via Biome checker (`pnpm run agent:lint`).
3. Integration and unit tests pass with a `0` exit status (`pnpm test` or specific vitest runners).
4. No unresolved tenant data leak or RLS violations exist in test suites.
5. The associated ticket in the current highest-priority unblocked `tickets/TICKET*.md` file is updated to `Status: completed`.
