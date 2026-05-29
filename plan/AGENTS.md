# CANONICAL AGENT INSTRUCTIONS (AGENTS.md)

This document contains absolute constraints, command references, and execution loop templates for all autonomous agent processes.

---

## 1. Absolute Code Boundaries

* **Absolute Core Isolation:** Files inside `packages/core` must NEVER import anything from `modules/*`, `apps/*`, or `extensions/*`.
* **Tenant RLS Boundary:** Every transaction query must reside under `withTenant(orgId, mockDb, ...)` session wraps to guarantee RLS security.
* **No Placeholders**: Writing partial snippets or comments like `// TODO: implement later` is strictly prohibited. Write fully realized production code.

---

## 2. Command Reference Suite

* **Workspace Verify (Compiler/Linter)**: `pnpm verify`
* **Workspace Rebuild**: `pnpm build`
* **Run Test Suite**: `pnpm test`
* **Auto-format Code**: `npx biome check --write .`
* **Targeted Test Execution**: `npx vitest run packages/testing/src/<test-name>.test.ts`

---

## 3. The Repeatable Agent Loop

Agents must strictly repeat this recursive loop:
1. **Status Check**: Run `git status` to ensure zero local modifications exist.
2. **Reconnaissance**: Read the unblocked active task spec in `plan/specs/`.
3. **Isolate**: Create a clean, separate Git branch or worktree for task isolation.
4. **Implement**: satisfy the specification with clean, modular, typescript type-safe code. Write extensive Vitest tests.
5. **Verify**: Execute local checks (`npx vitest run <file>`), and broad workspace checks (`pnpm verify`).
6. **Self-PR Review**: Self-audit files to ensure no console logs or debugging comments are left.
7. **Commit & Log**: Commit the changes using conventional messages and record completion inside `plan/PROGRESS.md`.
