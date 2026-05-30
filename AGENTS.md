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
1. `pnpm build` (acts as typecheck; strict TypeScript compilation without errors)
2. `pnpm run agent:lint` (Biome lint pass, no errors/warnings)
3. `pnpm test` (unit + integration tests; repository currently runs all Vitest suites through turbo)
4. `pnpm verify` (Workspace verification task)
5. `pnpm test:e2e` (Runs Playwright if configured; exits `0` with skip warning when no E2E config exists)

## 4. Code & Technical Constraints

* **Node.js Environment:** Target Node.js version is pinned to `22.0.0`. Never use unsupported dynamic imports or platform-specific APIs that deviate from Node 22 baseline.
* **No Placeholders:** Never generate placeholder or "TODO" comments in code blocks. Write fully realized implementations.
* **Keep Files Slim:** Keep standard file lines under 400 lines (governed by the `ralph.yml` budget).

---

## 5. Canonical Agent Guidance

### 5.1 Read-First Order
Agents must read the following files in sequence upon startup:
1. `AGENTS.md` (Self, this file) - Execution boundaries, rules, repeatable loop.
2. `GOAL.md` - System architectural blueprint, high-level scope, definition of done.
3. `ROADMAP.md` - Phased implementation plans, risk maps, unblocked tickets.
4. `docs/ai/REPO_MAP.md` - Current code layout, core modules, testing entry points.
5. The highest-priority unblocked ticket in `tickets/` (for example `tickets/TICKET004.md`).

### 5.2 The Repeatable Agent Loop
Agents must execute tasks recursively by strictly repeating this workflow:
1. **Status Check**: Run `git status` first; ensure zero local changes are modified or overwritten.
2. **Reconnaissance**: Read the read-first order files + the active spec in `.ralph/specs/` matching the ticket.
3. **Ticket Selection**: Claim the lowest-numbered unblocked ticket in `tickets/`. Mark it as `Status: in_progress`.
4. **Execution**: Perform the smallest, cleanest change to satisfy the specification. Write targeted unit/integration tests.
5. **Targeted Checks**: Run local validation commands targeting the edited code (e.g. `npx vitest run <file>`).
6. **Broad Checks**: Run workspace-wide verification checks (`pnpm verify` and `pnpm test`).
7. **Ticket Resolution**: Update the ticket to `Status: completed`. Record verification command exit status.
8. **Follow-ups**: Update the `ROADMAP.md` and document any unresolved follow-up items.
9. **Synthesis**: Concisely summarize found, changed, ran commands, and the single best next ticket.

### 5.3 Full Command Reference
- **Bootstrap Workspace**: `pnpm install` or `pnpm run agent:bootstrap`
- **Verify Clean Code & Format**: `pnpm verify` or `pnpm run agent:check`
- **Run Unit/Integration Tests**: `pnpm test` or `pnpm run agent:test`
- **E2E Behavior**: `pnpm test:e2e` or `pnpm run agent:test:e2e` and exits cleanly with a skip warning when no Playwright config is available.
- **Build Workspace**: `pnpm build` or `pnpm run agent:typecheck`
- **Targeted Test Execution**: `npx vitest run <test-file-path>`
- **Biome Format & Lint Fix**: `pnpm run agent:format` and `pnpm run agent:lint`
- **Diagnostics**: `pnpm run agent:doctor`

### 5.4 Coding Conventions
- **TypeScript**: Pinned to Node 22 baseline. Strict type checks. Ensure clean module boundaries.
- **REST APIs**: Pinned to Hono engine routes under `apps/api/src/index.ts`. All step-specific properties must have Zod-like validations.
- **Row-Level Security (RLS)**: Crucial database security boundary. Tenant organization isolation context is mandatory. Always wrap transactional blocks in `withTenant` matching the organization context.
- **Drizzle ORM**: Schemas are declared in `packages/db/src/schema.ts`. Mock db stores in `packages/db/src/index.ts` must exactly align with actual schema definitions.

### 5.5 Autonomous vs. Ask Boundary Rules
- **Proceed Autonomously**: Creating/modifying files, fixing bugs, creating test suites, building, resolving tickets.
- **Stop and Ask**: Ambiguous missing credentials, real legal/security vulnerabilities, paid/production deployments, potential data-loss operations.

### 5.6 Token Efficiency Protocols
- **Never Blind-Scan**: Use `docs/ai/REPO_MAP.md` and target specific subdirectories. Avoid scanning massive node_modules or dist folders.
- **Use Ripgrep strategically**: Target searches specifically using `grep_search` rather than reading large files line-by-line.
- **Skip Noise**: Always respect the rules outlined in `.aiignore`.

*Last Updated: May 29, 2026*
