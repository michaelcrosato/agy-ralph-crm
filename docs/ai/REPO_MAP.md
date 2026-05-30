# REPOSITORY STRUCTURE MAP (REPO_MAP.md)

This file catalogs where core logic, tests, entry points, configuration, and verification tools reside, enabling agents to navigate without directory blind-scanning.

---

## 1. Repository Topology

```text
crm-core/
├── apps/
│   ├── api/                   # Hono Engine Routing (REST, tRPC, MCP, Webhooks)
│   │   └── src/index.ts       # Central API entry point & Hono controllers
│   └── web/                   # Next.js 16 Interface UI dashboard shell
├── packages/
│   ├── core/                  # Clean business domain logic & Zod contracts
│   │   └── src/index.ts       # Sequence execution, personalizations, timeline logging
│   ├── db/                    # Drizzle ORM config, schemas, & mocked stores
│   │   ├── src/schema.ts      # Main schema declarations
│   │   └── src/index.ts       # tenant isolation wrappers (withTenant)
│   ├── auth/                  # Session tokens and permissions engine
│   └── testing/               # Integration, property-based RLS, & fuzz-testing
│       └── src/               # 129 comprehensive Vitest integration tests
├── modules/
│   ├── service-lite/          # Structural standalone ticketing extension
│   └── _template/             # Default template for new modules
├── scripts/
│   └── agent/                 # Central cross-platform diagnostic utility scripts
├── tickets/                   # Atomic, executable step-by-step task logs
└── .ralph/
    └── specs/                 # 130 granular functional specifications
```

---

## 2. Directory Navigation Cheat Sheet

| Domain Objective | Primary Target Location | Secondary Files to Inspect |
| --- | --- | --- |
| **REST Router Endpoints** | `apps/api/src/index.ts` | `packages/core/src/index.ts` |
| **Database Schema** | `packages/db/src/schema.ts` | `packages/db/src/index.ts` |
| **Sequence Delivery Primitives** | `packages/core/src/index.ts` | `packages/db/src/schema.ts` |
| **Integration Test Suites** | `packages/testing/src/` | `packages/testing/package.json` |
| **Agent Automation Helpers** | `scripts/agent/` | `package.json` |

---

## 3. Folders and Files to Skip

To maintain token efficiency and prevent memory pollution, agents must absolutely ignore:
- All `/dist/` and `/build/` subdirectories.
- `/node_modules/` dependencies.
- Root log files, specifically `test_output.log`.
- Scaffolding memory logs under `.ralph/tasks/` or `.ralph/memories/`.

---

## 4. MCP Tools & Verification

The codebase includes Model Context Protocol (MCP) servers integrated under `modules/service-lite` to allow external agents to securely query systems context.
Verification of all modules is centralized under:
- `pnpm verify` (Formatting, linting, compile verification)
- `pnpm test` (Full integration test suite execution)
- `pnpm test:e2e` (Playwright-based E2E checks when configuration exists; skipped with warning if absent)

## 5. AFK Workflow

Use this order for every coding loop:
1. Read `AGENTS.md`, `GOAL.md`, `ROADMAP.md`, `docs/ai/REPO_MAP.md`.
2. Read the highest-priority pending `tickets/TICKET0NN.md`.
3. Run `pnpm run agent:status` for quick repo context.
4. Execute the smallest atomic ticket steps and keep edits scoped.
5. Run `pnpm run agent:check` (format + lint + typecheck + test).
6. Update ticket status and notes.
7. For unattended AFK execution, use `run-afk-loop.ps1` at repository root.

## 6. Debugging & Diagnostics

- `pnpm run agent:doctor` for environment health checks.
- `pnpm run agent:bootstrap` to (re)install workspace dependencies.
- `pnpm run agent:check` for full automated verification path.
- `test_output.log`, `playwright-report/`, `coverage/` for recent failure evidence.

## 7. Dependencies Overview

- Runtime: Node.js `22.0.0` (repo baseline).
- Package manager: `pnpm` workspace with Turbo orchestration.
- Local checks are implemented via `@biomejs/biome` and Vitest.
- API stack: `hono`, mock-backed workspace packages.

## 8. MCP / Runtime Connectors

- `modules/service-lite` includes MCP support and external query adapters.
- No direct runtime dependency on MCP inside `packages/core`; integration stays in modules.
