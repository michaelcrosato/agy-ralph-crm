# Modular CRM Core System (README.md)

Welcome to the Modular CRM Core codebase. This repository is built as a highly robust, multi-tenant relational CRM operating system designed for **100% autonomous AI generation** and execution.

---

## 🚀 Human Quick Start

### 1. Requirements
- **Node.js**: `v22.0.0` (immutably targeted baseline)
- **Package Manager**: `pnpm` (workspace linkages via Turborepo)

### 2. Installation
Enable corepack so pnpm matches the version pinned in `package.json#packageManager`, then install:
```bash
corepack enable
corepack prepare pnpm@$(node -e 'console.log(require("./package.json").packageManager.split("@")[1])') --activate
pnpm install
```

`pnpm run agent:bootstrap` performs the corepack step automatically.

### 3. Run Development Server
To launch both Hono API and Next.js UI local servers concurrently:
```bash
pnpm dev
```

### 4. Build workspace Packages
To compile all modules and build optimized bundles:
```bash
pnpm build
```

### 5. Run Verification Checks
To verify formatting, typescript compilation, and linting rules workspace-wide:
```bash
pnpm verify
```

### 6. Run Test Suites
To run all integration and unit tests (currently 403 tests across 129 Vitest files):
```bash
pnpm test
```

### 6b. Optional E2E Checks
To run Playwright E2E checks if a config is present (or skip with a non-failing warning when absent):
```bash
pnpm test:e2e
```

---

## 📂 Repository Topology & Agent Guides

For detailed architectural master plans, roadmaps, and central execution loops:
- **System Master Plan**: [GOAL.md](/GOAL.md)
- **Development Path & Milestones**: [ROADMAP.md](/ROADMAP.md)
- **Autonomous Agent Loop & Rules**: [AGENTS.md](/AGENTS.md)
- **Repository Structure Map**: [docs/ai/REPO_MAP.md](/docs/ai/REPO_MAP.md)

### 7. AFK Helper Commands
- `pnpm run agent:bootstrap` - install dependencies
- `pnpm run agent:status` - print git/state summary
- `pnpm run agent:check` - format, lint, typecheck, and tests
- `pnpm run agent:doctor` - environment health diagnostics
- `./run-afk-loop.ps1` - long-running AFK orchestration loop (PowerShell)

### Open Tickets
- [TICKET001: Workspace Bootstrap (Completed)](/tickets/TICKET001.md)
- [TICKET002: Agent Automated Scripts (Completed)](/tickets/TICKET002.md)
- [TICKET003: Call Actions Feature & Bugfix (Completed)](/tickets/TICKET003.md)
- [TICKET004: Interactive tRPC Dashboard Analytics API](/tickets/TICKET004.md)
- [TICKET005: Lead SLA Breaches Email Notification Service](/tickets/TICKET005.md)
- [TICKET006: Dynamic Picklist Dependency Validation](/tickets/TICKET006.md)
