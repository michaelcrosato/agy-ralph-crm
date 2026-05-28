# SYSTEM ARCHITECTURE MASTER PLAN: MODULAR CRM CORE

**Orchestration Target:** Ralph v2.9.3

**System Status:** Architectural Baseline Verification

**Date of Record:** May 26, 2026

---

## 1. Executive Architecture Blueprint & Principles

This document serves as the definitive structural plan for building a clean, token-efficient, modular CRM operating system engineered for **100% autonomous AI generation**. This layout is structured to optimize the reasoning loops of the Ralph v2.9.3 orchestrator.

### Core Philosophy

* **Zero Human Coding:** Humans act strictly as architectural, security, and verification gates. All code generation and test execution are handled by Ralph loops.
* **Boring, Explicit Primitives:** Avoid complex abstractions. Prefer explicit files, local schemas, declarative contracts, and strict compile-time types.
* **Hard Core Isolation:** Core functionality must never import code from extensions or customer branches. Customizations hook into explicit, metadata-driven seams.

```text
       ┌────────────────────────────────────────────────────────┐
       │                   Browser CRM Client                   │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │             Next.js 16 Web App Shell                   │
       └───────────────────────────┬────────────────────────────┘
                                   │ (tRPC / REST / MCP)
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                   Hono API Routing Layer               │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │         packages/core (Pure Relational Domain)         │
       ├───────────────────────────┼────────────────────────────┤
       │ Accounts & Contacts       │ Leads & Opportunities      │
       ├───────────────────────────┼────────────────────────────┤
       │ Metadata Configuration    │ Permission Engine & Audit  │
       └───────────────────────────┬────────────────────────────┘
                                   │ (Drizzle ORM)
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │          PostgreSQL Database Storage Layer            │
       ├────────────────────────────────────────────────────────┤
       │ Relational Engine   │ JSONB Fields  │ Row-Level Sec.  │
       └────────────────────────────────────────────────────────┘

```

### Scope Governance Matrix

| Functional Category | Included in Hard Core | Shipped as First-Party Module | Restricted to Extension / Fork |
| --- | --- | --- | --- |
| **Identity & Security** | Tenants, RLS, Roles, Object/Field Perms |  |  |
| **Sales Fundamentals** | Accounts, Contacts, Leads, Opportunities |  |  |
| **Activity Tracking** | Tasks, Notes, Attachments, Logged Emails |  |  |
| **Data Customization** | `field_definitions`, Picklists, Layouts |  |  |
| **Analytics Engine** | Saved Views, Reports, Dashboards |  |  |
| **Integrations API** | REST/OpenAPI, Webhooks, MCP Server |  |  |
| **Productivity Apps** |  | `service-lite`, Email/Cal Sync |  |
| **Advanced Sales** |  |  | Quotes, CPQ, Commissions |
| **Complex Workflows** |  |  | Approval Trees, Territories |

---

## 2. Technical Stack Specification

The engineering stack is optimized for execution speed, local testability, deterministic validation, and low token footprint.

* **Runtime Engine:** Node.js v22 pinned baseline (ensures absolute environment stability across all Ralph execution nodes).
* **Monorepo Tooling:** `pnpm` workspaces managed via `turbo`.
* **Frontend Framework:** Next.js 16 (App Router for shell rendering and navigation; business/CRM execution logic is explicitly barred from living in Server Actions).
* **API Router Layer:** Hono (chosen for its tiny surface area, raw speed, and native TypeScript compilation).
* **Internal Data Binding:** `tRPC` for type-safe frontend-to-backend communication without intermediary build artifacts.
* **AI Access Layer:** Model Context Protocol (MCP) Server exposed directly by the API to enable customer-deployed AI assistants to safely query system data under strict authorization rules.
* **Persistence Architecture:** PostgreSQL (v17+ native) driven by Drizzle ORM.
* *Search Core:* Powered natively by `pg_trgm` full-text indices.
* *Vector Space:* `pgvector` extension reserved for future standalone AI search models.


* **Verification Stack:** Biome (linting/formatting), Vitest (unit/integration execution), Playwright (E2E workflows).
* **Orchestration Tooling:** Direct configuration using official scoped packages:
* `@ralph-orchestrator/ralph-cli@2.9.3`
* `@ralph-orchestrator/ralph-api@2.9.3`
* `@ralph-orchestrator/ralph-e2e@2.9.3`
* `@ralph-orchestrator/ralph-bench@2.9.3`



---

## 3. Repository Topology

The repository layout establishes explicit horizontal and vertical isolation boundaries, ensuring agents require only local context files to execute code changes.

```text
crm-core/
├── .ralph/                    # Ralph Agent Context & Scaffolding
│   ├── memories/              # Persistent cross-run contextual memories
│   ├── specs/                 # Active implementation plans
│   └── tasks/                 # Granular autonomous execution logs
├── apps/
│   ├── api/                   # Hono Engine (HTTP, tRPC, REST, MCP, Webhooks)
│   │   └── AGENTS.md          # Local API execution constraints
│   └── web/                   # Next.js 16 Interface Shell
│       └── AGENTS.md          # Local UI execution constraints
├── packages/
│   ├── audit/                 # Immutable event ledger definitions
│   ├── auth/                  # Identity, Session Management, API token states
│   ├── core/                  # Clean domain engine (Pure functions, Zod contracts)
│   │   ├── accounts/
│   │   ├── contacts/
│   │   ├── leads/
│   │   ├── opportunities/
│   │   └── AGENTS.md          # Strict business-logic boundaries
│   ├── db/                    # Drizzle configurations, migrations, seeds, RLS
│   │   └── AGENTS.md          # SQL & migration rules
│   ├── metadata/              # Layout, picklist, and custom field validation schemas
│   ├── reporting/             # Non-SQL query definition and compilation engine
│   ├── search/                # pg_trgm compilation and vector extensions
│   ├── testing/               # Testcontainers, property-based RLS generators
│   ├── ui/                    # Shared headless components & style tokens
│   └── workflow/              # Event-Condition-Action (ECA) grammar parsers
├── modules/                   # Default first-party modules (Architecturally isolated)
│   ├── _template/             # Structural scaffold for first-party modules
│   └── service-lite/          # Minimalist ticketing subsystem
├── bench/                     # Token performance, compute-cost, and query tracing
├── e2e/                       # Global cross-module Playwright suites
├── infra/                     # Production deployment configurations (Docker/WSL)
├── docs/                      # Human-immutable system truth
│   ├── architecture/          # ADR documents, Data models, RLS maps
│   ├── product/               # PRD foundations, Scope-gate records
│   └── ai/                    # Repo maps, Agent instructions
├── AGENTS.md                  # Root agent rules (Max 200 lines)
├── CLAUDE.md                  # Verification command configurations
├── package.json
└── turbo.json

```

---

## 4. Core Domain & Data Model Engine

### Storage Schema Approach

The relational model remains fixed for primitive tables. Dynamic mutations are supported via strongly managed `custom` JSONB stores governed by a dedicated system metadata table.

#### The Schema Core

```text
organizations (id, name, status, created_at)
users (id, email, password_hash, status)
memberships (id, org_id, user_id, role_id)
roles (id, org_id, name, permissions_mask)
field_definitions (id, org_id, object_type, api_name, label, data_type, validation_rules)
accounts (id, org_id, owner_id, name, domain, custom JSONB)
contacts (id, org_id, owner_id, account_id, first_name, last_name, email, custom JSONB)
leads (id, org_id, owner_id, status, email, company, converted_account_id, converted_contact_id, custom JSONB)
opportunities (id, org_id, owner_id, account_id, stage, amount, close_date, custom JSONB)
activities (id, org_id, creator_id, type [task|call|note|email], subject, body, due_date)
activity_links (id, org_id, activity_id, target_type, target_id)

```

### Multi-Tenant Multi-Tenant Isolation (RLS Engine)

Database-level tenancy security is non-negotiable. Application checks act only as user interface buffers; the physical database engine drops leaks via native PostgreSQL Row-Level Security.

> **RLS Policy Requirement:** Every query to a tenant table must pass through a strict session variable validation context check.

```sql
-- Architectural Blueprint for Tenant Security Execution
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON accounts
    FOR ALL
    USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

```

#### Verification Constraint

The CI/CD framework mandates property-based security tests within `packages/testing`:

1. Generate twenty randomized organizations containing intersecting identifiers.
2. Spin up concurrent agent processes simulating cross-tenant requests.
3. Assert that any data leak attempt throws an absolute database execution failure.

---

## 5. AI-Driven Execution & Operating Model

### Context Optimization File Layout (`AGENTS.md`)

To guarantee optimal context consumption and mitigate token drift, developer guidance files are highly structured, bounded, and modularized.

* **Root `AGENTS.md` (Max 200 lines):** Restricts architectural modifications. Outlines absolute constraints against importing extensions into the core system layer.
* **Path-Scoped `AGENTS.md` (Max 100 lines per location):** Localized strictly inside `apps/*` and `packages/*`. Defines immediate test hooks, local directories, and anti-patterns for that particular module.

### Specification-Driven Definition of Done

Ralph loops execute modifications solely against pre-defined engineering design files. Tasks must never begin from loose prompts.

```text
.ralph/specs/[task-increment-id]/
├── brief.md                   # Human-defined performance objective
├── requirements.md            # Comprehensive functional criteria
├── design.md                  # Explicit API, database, and type mappings
├── implementation-plan.md     # Step-by-step file generation sequence
└── verification.md            # Concrete shell verification scripts

```

#### Absolute Rule for Task Completion

A specification is verified and marked complete only when the scripts explicitly declared within `verification.md` return exit code `0` across all target environments.

```bash
# Standard Verification Gate Array Required for Every Completed Specification
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm test:e2e
ralph-bench --budget=bench/agent-cost/budget.json

```

### Variant Separation Framework (Customer Customization)

Custom client implementations prioritize modular execution paths over permanent code state splitting.

1. **Configuration Tiers:** Leverage internal metadata tables (`field_definitions`, layout schemas).
2. **Module Placement:** House standalone customizations directly within `extensions/customer-name/` on the main branch.
3. **Branch Strategy (Absolute Fallback):** Private variants utilize branch tracking (`customers/name-variant`). They must pass through a mandatory validation sequence before integration.

```text
                           [Main CRM Core Branch]
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
     [Metadata Layer Config]                 [Customer Fork Isolation]
     - field_definitions                     - customer/acme-variant
     - layout_definitions                    - Mandatory weekly rebase gates
     - Zero core source mutations            - Zero core file interventions

```

---

## 6. Multi-Phase Implementation Roadmap

```text
 PHASE 0         PHASE 1         PHASE 2         PHASE 3         PHASE 4         PHASE 5         PHASE 6
 ───┬───        ───┬───        ───┬───        ───┬───        ───┬───        ───┬───        ───┬───
    │              │              │              │              │              │              │
    ├── Scaffold   │              │              │              │              │              │
    │   Workspace  │              │              │              │              │              │
    └── Setup CI   ├── Identity   │              │              │              │              │
                   │   & Auth     │              │              │              │              │
                   └── Init RLS   ├── Core CRM   │              │              │              │
                                  │   Records    │              │              │              │
                                  └── Timelines  ├── Custom     │              │              │
                                                 │   Metadata   │              │              │
                                                 └── Reporting  ├── Workflows  │              │
                                                                │   & Actions  │              │
                                                                └── OpenAPI    ├── MCP Read   │
                                                                               │   Tools      │
                                                                               └── Service-   │
                                                                                   Lite       └── Scale
                                                                                                  Bench

```

### Phase 0: AI-Safe Foundation Setup

* **Deliverables:** Monorepo scaffolding, configurations for `pnpm` workspace, `turbo`, Next.js 16, Hono, Drizzle metadata initialization, local Postgres setups, and core verification tools.
* **Exit Criteria:** Clean installation with `pnpm install`, and `pnpm verify` returns success out-of-the-box.

### Phase 1: Identity, Tenancy, & Security Foundation

* **Deliverables:** Organization registration, account membership records, permission sets, tenant context token parser engines, and global RLS activation profiles.
* **Exit Criteria:** Data-leakage regression verification passes, proving total isolation across test tenants.

### Phase 2: Primitive Record Core & Event Timelines

* **Deliverables:** Core implementation for Accounts, Contacts, Leads, and Opportunities. Generates full auditing ledgers for tracking change histories, standard text searches, and chronological timeline logs.
* **Exit Criteria:** Comprehensive execution logic validated for end-to-end lead conversion flows (Lead $\rightarrow$ Account + Contact + Opportunity).

### Phase 3: Metadata Customization Engine & Analytical Reporting

* **Deliverables:** Dynamic `field_definitions` execution handlers, dynamic JSONB input validation parsing routines, form layout metadata compilation wrappers, and custom layout configuration parameters.
* **Exit Criteria:** Successful layout injection showing full persistence, indexing, and verification of dynamic user fields.

### Phase 4: Workflow Engine & External Interface Integration

* **Deliverables:** Event-Condition-Action (ECA) workflow parser processing changes, dynamic automated field assignment routines, system notification adapters, external outbound webhook transmitters, and secure REST/OpenAPI endpoint routes.
* **Exit Criteria:** Automated event testing confirms that modifying a sales opportunity stage correctly kicks off down-stream background notifications and webhook delivery cycles.

### Phase 5: Managed First-Party Core Extensions

* **Deliverables:** Minimalist ticket tracking infrastructure (`modules/service-lite`), manual outbound email log adapters, pipeline trackers, and standardized Model Context Protocol (MCP) data lookup servers.
* **Exit Criteria:** Activating the `service-lite` module introduces system ticketing capabilities without requiring changes to core sales code files.

### Phase 6: Performance Optimization & Testing Matrix

* **Deliverables:** Fuzz testing components, mock generation tools seeding up to 1M tracking elements, automated migration rollbacks, and budget validations via `@ralph-orchestrator/ralph-bench`.
* **Exit Criteria:** System benchmarks demonstrate stable resource footprints and context usage metrics that comply with defined infrastructure budgets.

---

## 7. Execution Phase 0: Initialization Specification

```text
================================================================================
RALPH INITIALIZATION SPECIFICATION: PHASE 0 FOUNDATION SCRATCHPAD
================================================================================
TARGET ARCHITECTURE: pnpm / Turborepo / Next.js 16 / Hono / Drizzle / Postgres
EXECUTION PROFILE: Bounded, Deterministic Setup Loop
================================================================================

```

### Purpose

Establish the foundational infrastructure workspace environment, complete with structural package trees, automated tooling configurations, diagnostic enforcement parameters, and documentation frameworks. **No application business features are to be developed in this step.**

### Required Directory Mapping

The agent must generate the following file tree framework exactly:

```text
apps/web/package.json
apps/api/package.json
packages/core/package.json
packages/db/package.json
packages/auth/package.json
packages/metadata/package.json
packages/workflow/package.json
packages/audit/package.json
packages/search/package.json
packages/reporting/package.json
packages/ui/package.json
packages/testing/package.json
modules/_template/package.json
modules/service-lite/package.json
.ralph/specs/0000-initial-scaffold/verification.md

```

### Immutable Configuration Ground Truths

#### 1. Root Workspace Configuration (`package.json`)

```json
{
  "private": true,
  "engines": {
    "node": "22.0.0"
  },
  "scripts": {
    "verify": "turbo run verify",
    "build": "turbo run build",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "biome": "^1.8.0"
  }
}

```

#### 2. Orchestrator Integration Pattern (`ralph.yml`)

```yaml
ralph_version: "2.9.3"
project_type: "typescript-monorepo"
verification_command: "pnpm verify"
budgets:
  max_context_tokens: 32768
  max_file_lines_standard: 400
allowlisted_commands:
  - "pnpm typecheck"
  - "pnpm lint"
  - "pnpm test"

```

#### 3. Primary Workspace Routing Maps (`pnpm-workspace.yaml`)

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "modules/*"

```

### Comprehensive Phase 0 Verification Target

To close out Phase 0, the agent must ensure that issuing the command `pnpm verify` runs down-stream pipelines via `turbo` to validate that:

* Workspace linkages connect perfectly with zero broken symlinks.
* Every module compiles cleanly without type discrepancies or linting errors.
* Drizzle validation routines process successfully against local environment configurations.
* The system documentation matches the system architecture map.

---

## 8. Final Synthesis: Architectural Mapping

This master plan provides a single, cohesive structural blueprint for building the CRM system. It maps out the code boundaries, stack dependencies, multi-tenant security layers, and agent execution workflows required to ensure clear separation of concerns.

This plan serves as the source of truth for the system architecture. Ralph loops can now consume, reason about, and execute this roadmap from day one. All code changes must align with this master blueprint, and all milestones must pass the verification gates established herein.