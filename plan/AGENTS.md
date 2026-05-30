# /plan/AGENTS.md — Execution Rules for Blueprint Implementation

> Scope: when running the blueprint in `plan/ROADMAP.md` and `plan/specs/`. For repo-wide rules (RLS, monorepo isolation, file budgets), see root [AGENTS.md](/AGENTS.md) — that file remains the ultimate source of truth.

---

## 1. Pre-flight (every loop iteration)

1. `git status` — abort if working tree is dirty AND the dirt isn't this loop's progress.
2. `pnpm run agent:bootstrap` — corepack-managed pnpm install. Skip if `node_modules` recent (< 24h).
3. `pnpm run agent:doctor` — Node version, advisory count, outdated count. **Exit ≠ 0 ⇒ stop, open a follow-up spec instead of continuing.**
4. Read `plan/PROGRESS.md` — claim the lowest-numbered unblocked `[ ] Todo`. Mark `[~] In Progress` with your agent ID.

## 2. Per-spec workflow

For each claimed spec (`plan/specs/NNN_…md`):

1. Read the spec end-to-end. If anything is ambiguous, **stop and ask**.
2. Read the **Depends on** chain — confirm every listed dep is `[x] Done` in PROGRESS.md.
3. Read all "Likely files" / "Implementation Approach" paths. Use `Grep`/`Glob`, not blind `Read` on large files.
4. **Make the smallest change that satisfies the DoD.** Do not bundle other specs into this one. Do not refactor adjacent code unless explicitly listed.
5. After each cohesive change, run targeted checks:
   - `npx vitest run packages/testing/src/<relevant>.test.ts` for the affected suite(s).
   - `pnpm exec biome check --write <changed-paths>` to autoformat.
   - `pnpm exec tsc --noEmit -p <changed-package>` for typecheck of just the touched package.
6. When all DoD items are ✅, run the broad gates:
   - `pnpm verify` (turbo verify across workspace).
   - `pnpm test` (full 403-test suite — must remain green).
   - `pnpm build` (typecheck via tsc).
   - (post-spec 021) `pnpm test:e2e` if the change touches `apps/web` or `apps/api` routes.
7. Update `plan/PROGRESS.md`: tick the spec to `[x] Done`, attach commit SHA + run timestamp + pass counts.
8. If a follow-up is discovered, create `plan/specs/NNN_followup_<slug>.md` and add a new row to PROGRESS.md.
9. Commit. Commit message format: `feat(spec/NNN): <short summary>` (or `fix`, `refactor`, `docs`, `chore`).

## 3. Environment Verification Commands

| Purpose | Command | Notes |
| --- | --- | --- |
| Bootstrap workspace | `pnpm run agent:bootstrap` | corepack-aware |
| Doctor / health | `pnpm run agent:doctor` | exits ≠ 0 on high/critical advisories |
| Status (git) | `pnpm run agent:status` | quick snapshot |
| Full check | `pnpm run agent:check` | format + lint + typecheck + test |
| Format only | `pnpm run agent:format` | `biome check --write .` |
| Lint only | `pnpm run agent:lint` | `biome check .` |
| Typecheck only | `pnpm run agent:typecheck` | `pnpm build` |
| Test (unit + integration) | `pnpm test` | turbo run test |
| E2E | `pnpm test:e2e` | no-op skip until spec 021 |
| Verify (workspace) | `pnpm verify` | turbo run verify |
| Targeted test | `npx vitest run <path>` | for fast feedback |

## 4. Guardrails (autonomous boundary)

**Proceed without asking** when:
- Editing source/tests/docs to satisfy a DoD checkbox.
- Adding/removing dev dependencies inside the spec's stated scope.
- Generating migrations via `drizzle-kit generate` (review SQL diff before commit).
- Creating new files under `plan/specs/NNN_followup_*.md`.

**Stop and ask** when:
- A change requires paid API credentials not present in `.env.example`.
- A change touches production data, requires destructive DB ops (`DROP`, `TRUNCATE`), or alters CI permissions.
- The DoD requires a security trade-off (e.g., disabling RLS, weakening auth).
- A test failure points to a real bug outside the current spec scope — open a spec, don't silently fix it.
- Multiple specs would conflict on the same files (coordinate via PROGRESS.md notes).

**Never**:
- Push to `main` directly.
- Force-push or amend commits already on a shared branch.
- Skip git hooks (`--no-verify`).
- Commit secrets. `.env.example` only.
- Run `git clean -fd` without explicit user confirmation.

## 5. Spec dependency invariants

Phase 0 specs (001–008) are independent and parallelizable. Phase 1+ depends on Phase 0 stability. See `plan/ROADMAP.md` §4 prioritization table for explicit `Dep` column.

Critical chains:
- **DB realization**: 012 → 013 → 014 → 015 → 024
- **API modularization**: 010 → 017 → 018 → 023
- **Observability**: 016 → 022
- **Custom objects**: 011 → 014 → 031
- **MCP first-class**: 011 → 030 → 031 (custom objects exposed via MCP)
- **Workflow conditions**: 011 → 032

## 6. File budgets (enforced via review)

- Standard source files: **≤ 400 lines** (`ralph.yml#budgets.max_file_lines_standard`).
- Transition tolerance during spec 010/011/012: ≤ 800 lines per resulting subfile. File a follow-up spec if any subfile exceeds 600 lines after the split.
- Tests: no line limit, but split if > 1000 lines.

## 7. Honesty Protocol

- Never claim a check passed unless its command actually ran and exited 0 in your transcript.
- Record absent gates as "not found" in commit messages (e.g., "E2E: not found — see spec 021").
- If you fix a bug outside the spec scope, document it in PROGRESS.md notes; do not bury it in a spec commit.
- When in doubt, open a follow-up spec rather than fold work into the current one.

## 8. Maintenance Loop (weekly, autonomous)

1. Pull `main`. Bootstrap. Doctor.
2. If `pnpm audit` reports new `high`/`critical`: open `plan/specs/NNN_security_<cve>.md`.
3. If `pnpm outdated --recursive` reports new majors: open `plan/specs/NNN_upgrade_<pkg>.md`.
4. Pick the next unblocked spec from PROGRESS.md; run §2 workflow.

---

*Last Updated: 2026-05-29*
