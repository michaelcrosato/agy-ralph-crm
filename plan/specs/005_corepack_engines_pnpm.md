# 005 — Pin pnpm via corepack; relax `engines.node`

**Phase:** 0 · **Priority:** Medium · **Status:** `[ ] Todo`

## Description & Expected Impact
`engines.node: "22.0.0"` (exact) yields `Unsupported engine` warnings for any patched 22.x and blocks corepack-driven pnpm bootstraps. `packageManager` already declares `pnpm@11.1.2` but no corepack enablement is documented. Align with 2026 monorepo standard: corepack-managed pnpm + permissive node range.

## Definition of Done & Acceptance Criteria
- [ ] `engines.node` → `">=22.22.0 <23"` (mirrors spec 001).
- [ ] `engines.pnpm` → `">=11.1.2 <12"` added.
- [ ] `README.md` bootstrap section instructs `corepack enable && corepack prepare pnpm@$(node -e 'console.log(require("./package.json").packageManager.split("@")[1])') --activate`.
- [ ] `scripts/agent/bootstrap.sh` and `bootstrap.ps1` auto-run `corepack enable` if `pnpm` is not on PATH.
- [ ] No `Unsupported engine` warnings on `pnpm install` with Node 22.22.0.

## Implementation Approach
- Edit root `package.json` engines + packageManager.
- Edit `scripts/agent/bootstrap.sh` to insert `command -v corepack && corepack enable` before package manager detection.
- Edit `scripts/agent/bootstrap.ps1` similarly: `if (Get-Command corepack -ErrorAction SilentlyContinue) { corepack enable }`.
- Update README.md "Installation" subsection.

## Test Strategy
- Manual: on Node 22.22.0 without pnpm, run `bootstrap.sh` — expect corepack to activate pnpm and `pnpm install` to succeed.
- Regression: `pnpm run agent:doctor` still reports versions correctly.

## Rollback
Revert engines pin; remove corepack call from bootstrap.

## References
- [corepack docs](https://nodejs.org/api/corepack.html)
