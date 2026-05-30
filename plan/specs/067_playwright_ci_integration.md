# Spec 067 — TD-003: Continuous Playwright E2E Integration in CI

## Description & Impact

Establish continuous web interface validation inside the GitHub Actions pipeline:
- Add a dedicated `test-e2e` job inside `.github/workflows/ci.yml` to run the Playwright smoke suite.
- Automatically provision required Chromium runtime binaries in the virtual environment.
- Run E2E tests headless against a live spawned Next.js development server.
- Upload HTML failure reports and trace logs on execution failures as workflow artifacts.

**Impact:** Guarantees that any UI, route compilation, or dashboard layout regression is automatically caught prior to code merging, preventing deployment of broken layouts.

## Definition of Done

- [ ] Add `test-e2e` job in `.github/workflows/ci.yml`.
- [ ] Configure automatic caching for Playwright browser binaries to keep build times highly optimal.
- [ ] Use `pnpm run test:e2e:install` to fetch the chromium engine in CI.
- [ ] Execute `pnpm test:e2e` successfully inside the pipeline.
- [ ] Set `actions/upload-artifact@v4` block retrieving trace screenshots on failures.

## Approach

### Files modified or created
- `.github/workflows/ci.yml`
- `plan/specs/067_playwright_ci_integration.md`

## Test Strategy
- Trigger a GitHub action workflow dry-run or linting of the workflows structure.
- Execute local Playwright checks in full matching headless environment constraints.
