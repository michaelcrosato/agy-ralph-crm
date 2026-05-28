# SYSTEM-WIDE AGENT CONSTRAINTS & EXECUTION RULES (AGENTS.md)

This file defines the absolute boundaries and rules of engagement for all autonomous agent processes (Ralph orchestrator and sub-agents) working within this repository.

## 1. Monorepo Isolation & Boundary Rules

* **Absolute Core Isolation:** Files inside `packages/core` must NEVER import anything from `modules/*`, `apps/*`, or `extensions/*`. The core domain is a pure relational engine and must remain fully decoupled.
* **Seams-Only Extension:** Core behavior customization must be driven purely by metadata (`field_definitions`, JSONB configurations, layouts) or explicit interface implementations.
* **No Direct File Mutations in Third-Party Contexts:** Core application modules or customer forks in `extensions/` must remain architecturally isolated. Never edit core codebase files for client-specific features.

## 2. Specification-Driven Development (Definition of Done)

* **No Loose Prompts:** No implementation task may begin without a structured specification under `.ralph/specs/[task-increment-id]/`.
* **Execution Boundary:** Every specification directory must contain:
  1. `brief.md` - Functional/performance objective.
  2. `requirements.md` - Explicit requirements list.
  3. `design.md` - DB schemas, API endpoints, Zod contracts.
  4. `implementation-plan.md` - Step-by-step code generation sequence.
  5. `verification.md` - Concrete terminal verification commands.
* **Task Completion Constraint:** A specification is strictly complete ONLY when the verification scripts defined in `verification.md` return exit code `0` on the target system.

## 3. Strict Verification & Command Rules

Every change must successfully execute the verification sequence before pull-request submission:
1. `pnpm typecheck` (ensure TypeScript compiles without any errors)
2. `pnpm lint` (via Biome, no lint errors/warnings allowed)
3. `pnpm test:unit` & `pnpm test:integration` (Vitest suites must pass)
4. `pnpm test:e2e` (Playwright E2E suite must pass)
5. `pnpm verify` (Workspace verification task)

## 4. Code & Technical Constraints

* **Node.js Environment:** Target Node.js version is pinned to `22.0.0`. Never use unsupported dynamic imports or platform-specific APIs that deviate from Node 22 baseline.
* **No Placeholders:** Never generate placeholder or "TODO" comments in code blocks. Write fully realized implementations.
* **Keep Files Slim:** Keep standard file lines under 400 lines (governed by the `ralph.yml` budget).

---
*Last Updated: May 28, 2026*
