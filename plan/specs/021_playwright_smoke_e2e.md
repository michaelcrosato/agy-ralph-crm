# 021 — Playwright config + lead/contact/opportunity smoke E2E

**Phase:** 1 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 020

## Description & Expected Impact
`scripts/agent/test-e2e.sh` currently skips with a warning because no Playwright config exists. Add a thin smoke harness covering the three core CRM flows: create lead → convert → view; create account; create opportunity. This unblocks CI gates that should fail on broken UI without requiring a human to click through.

## Definition of Done & Acceptance Criteria
- [ ] `playwright.config.ts` in repo root (or `apps/web/playwright.config.ts`).
- [ ] `apps/web/e2e/` directory with 3 smoke specs:
  - `leads.spec.ts` — create + view + convert.
  - `accounts.spec.ts` — create + list + delete.
  - `opportunities.spec.ts` — create + add product + transition stage.
- [ ] `pnpm test:e2e` (re-uses spec 002's runner) actually runs Playwright and exits 0 against `pnpm dev`.
- [ ] CI job `e2e` added: spins up Postgres + API + Web via `docker-compose`, runs Playwright headed=false.
- [ ] Trace + screenshot artifacts uploaded on failure.

## Implementation Approach
- Use `@playwright/test` with the `webServer` config to auto-start `pnpm dev` before tests.
- Seed a deterministic test tenant via a `globalSetup` script that hits `/api/dev/seed` (gated by env flag).
- Keep test count small (~10 assertions total) — this is smoke, not exhaustive.

## Test Strategy
- E2E coverage: 3 happy-path flows; no fuzz, no negative cases (separate spec).
- CI gate: `e2e` job is required before merge.

## Rollback
Skip in CI via `if: false`; keep specs for local use.

## References
- [Playwright docs](https://playwright.dev/)
