# 007 — Dependabot config for weekly minor updates

**Phase:** 0 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 004

## Description & Expected Impact
Without automated dependency PRs, the maintenance loop is the only update path. Dependabot is GitHub-native (zero infra) and integrates with the CI added in spec 004. Restrict to **minor + patch** auto-PRs; majors require explicit human or AFK-agent review.

## Definition of Done & Acceptance Criteria
- [ ] `.github/dependabot.yml` created. Ecosystems: `npm` (pnpm-compatible), `github-actions`.
- [ ] Schedule: weekly (Monday 03:00 UTC).
- [ ] `versioning-strategy: increase-if-necessary`, `open-pull-requests-limit: 5`.
- [ ] Group config: group all minor + patch JS deps into a single `weekly-npm-minors` PR.
- [ ] Majors excluded via `ignore: [{ dependency-name: "*", update-types: ["version-update:semver-major"] }]`.
- [ ] First Dependabot PR is reviewed manually (sanity check).

## Implementation Approach
- File: `.github/dependabot.yml` (new).
- Use `package-ecosystem: npm` (Dependabot detects pnpm via lockfile, no special key needed).
- Add a second block for `github-actions` to keep workflow actions current.

## Test Strategy
- Manual: after merging, watch for the first Dependabot PR; confirm grouping + label.
- Regression: ensure CI from spec 004 runs against Dependabot PRs.

## Rollback
Delete `.github/dependabot.yml`.

## References
- [Dependabot grouped updates docs](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
