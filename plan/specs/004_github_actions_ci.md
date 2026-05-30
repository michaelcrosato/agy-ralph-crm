# 004 — GitHub Actions CI: enforce verify / build / test / typecheck

**Phase:** 0 · **Priority:** Critical · **Status:** `[ ] Todo`

## Description & Expected Impact
Repo currently has zero remote CI; AFK enforcement lives in `run-afk-loop.ps1` locally. Without required-status-checks on PRs, a broken main is one push away. Add `.github/workflows/ci.yml` that runs the same `pnpm run agent:check` matrix on every PR + push to `main`.

## Definition of Done & Acceptance Criteria
- [ ] `.github/workflows/ci.yml` created. Triggers: `pull_request` (any branch), `push: { branches: [main] }`.
- [ ] Jobs: `verify`, `build`, `test`, `typecheck`, `lint`. All run in parallel where dependency-safe (verify can fan out).
- [ ] Uses `actions/checkout@v4`, `pnpm/action-setup@v4` (corepack), `actions/setup-node@v4` with `node-version-file: .nvmrc` (matches spec 001).
- [ ] pnpm store cached via `actions/cache@v4` keyed on `pnpm-lock.yaml`.
- [ ] `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` — duplicate PR pushes cancel prior runs.
- [ ] CI passes on a sample PR.
- [ ] `README.md` updated with a CI badge.

## Implementation Approach
- File: `.github/workflows/ci.yml` (new).
- Use Node version from `.nvmrc` (introduced in spec 001).
- Each job runs `pnpm install --frozen-lockfile` then the relevant `pnpm run agent:*` script.
- Add `if: failure()` step to upload `test_output.log` artifact for triage.
- Do not enable required-status-checks branch protection automatically — document in PR description for human enablement.

## Test Strategy
- Manual: open a draft PR, confirm 5 green checks.
- Regression: introduce an intentional lint error in a feature branch → expect CI fail. Revert.

## Rollback
Delete `.github/workflows/ci.yml`.

## References
- [pnpm/action-setup](https://github.com/pnpm/action-setup)
- [Vitest CI guidance](https://vitest.dev/guide/cli)
