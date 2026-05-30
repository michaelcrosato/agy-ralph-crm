# 002 — Biome 1.8 → 2.4 (domains, type-aware linting, plugins)

**Phase:** 0 · **Priority:** Medium · **Status:** `[ ] Todo`

## Description & Expected Impact
Biome 2.0 introduced a project file scanner enabling cross-file rules; 2.4 adds embedded CSS/GraphQL snippet linting, lint domains, plugins, type-aware rules (`noFloatingPromises`), and import-organization improvements. Repo is on 1.8.0 — missing one major + four minors of correctness/perf wins. `biome migrate` is the supported one-shot.

## Definition of Done & Acceptance Criteria
- [ ] `@biomejs/biome` in root `package.json` and each `packages/*/package.json` bumped to `^2.4.0`.
- [ ] `biome.json` migrated via `pnpm exec biome migrate --write` (validates schema URL + new rule keys).
- [ ] Enable the `test` lint domain and `useConsistentTestIt` rule (since suite uses both `it` and `test`).
- [ ] Enable `noFloatingPromises` (type-aware) — fixes any unhandled-await regressions found in audit.
- [ ] `pnpm verify` exits 0; zero net new lint errors. Lint diffs landed as part of this spec, not future work.
- [ ] `scripts/agent/format.sh` / `format.ps1` still work via `pnpm exec biome check --write .`.

## Implementation Approach
- Bump version in 14 package.json files (root + apps/api + apps/web + 11 packages + 2 modules).
- `pnpm install` to refresh lockfile.
- `pnpm exec biome migrate --write` — applies schema updates.
- Update `biome.json#$schema` to `https://biomejs.dev/schemas/2.4.0/schema.json`.
- Run `pnpm exec biome check --write .` to apply any auto-fixes.
- Investigate + fix any `noFloatingPromises` reports surfaced by type-aware rule.

## Test Strategy
- Regression: full `pnpm test` must remain at 403/403 pass.
- Lint gate: `pnpm verify` must be clean.

## Rollback
Revert package.json pins, restore previous `biome.json`, `pnpm install`.

## References
- [Biome v2.0 blog](https://biomejs.dev/blog/biome-v2/)
- [Biome v2.4 blog](https://biomejs.dev/blog/biome-v2-4/)
