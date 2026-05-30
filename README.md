# Modular CRM Core System (README.md)

Welcome to the Modular CRM Core codebase. This repository is built as a highly robust, multi-tenant relational CRM operating system designed for **100% autonomous AI generation** and execution.

---

## 🚀 Human Quick Start

### 1. Requirements
- **Node.js**: `v22.0.0` (immutably targeted baseline)
- **Package Manager**: `pnpm` (workspace linkages via Turborepo)

### 2. Installation
To bootstrap the monorepo workspace and resolve all packages:
```bash
pnpm install
```

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
To run all 129 integration and unit tests:
```bash
pnpm test
```

---

## 📂 Repository Topology & Agent Guides

For detailed architectural master plans, roadmaps, and central execution loops:
- **System Master Plan**: [GOAL.md](file:///C:/dev/agy-ralph-crm/GOAL.md)
- **Development Path & Milestones**: [ROADMAP.md](file:///C:/dev/agy-ralph-crm/ROADMAP.md)
- **Autonomous Agent Loop & Rules**: [AGENTS.md](file:///C:/dev/agy-ralph-crm/AGENTS.md)
- **Repository Structure Map**: [docs/ai/REPO_MAP.md](file:///C:/dev/agy-ralph-crm/docs/ai/REPO_MAP.md)

### Open Tickets
- [TICKET001: Workspace Bootstrap (Completed)](file:///C:/dev/agy-ralph-crm/tickets/TICKET001.md)
- [TICKET002: Agent Automated Scripts (Completed)](file:///C:/dev/agy-ralph-crm/tickets/TICKET002.md)
- [TICKET003: Call Actions Feature & Bugfix (Completed)](file:///C:/dev/agy-ralph-crm/tickets/TICKET003.md)
- [TICKET004: Interactive tRPC Dashboard Analytics API](file:///C:/dev/agy-ralph-crm/tickets/TICKET004.md)
- [TICKET005: Lead SLA Breaches Email Notification Service](file:///C:/dev/agy-ralph-crm/tickets/TICKET005.md)
- [TICKET006: Dynamic Picklist Dependency Validation](file:///C:/dev/agy-ralph-crm/tickets/TICKET006.md)
