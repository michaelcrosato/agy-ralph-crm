# TICKET011: Continuous Playwright E2E Integration in CI

## Details
- **Status**: completed
- **Priority**: Medium
- **Goal**: Integrate the headless Playwright smoke E2E checks as a required quality gate in GitHub Actions.
- **Context**: TD-003 describes establishing Playwright execution inside the GitHub Actions pipeline.

---

## Scope

### In Scope
- Add `test-e2e` job inside `.github/workflows/ci.yml` running after dependencies installation.
- Install Playwright browsers dynamically via corepack-managed `pnpm run test:e2e:install`.
- Run E2E tests against Next.js frontend in headless mode via `pnpm test:e2e`.
- Upload HTML test reports, screenshots, and trace logs as artifacts on failure or run completion.
- Ensure 100% linter and typecheck success.

### Out of Scope
- Creating new browser test cases or changing Next.js routes.

---

## Steps to Execute
1. Update `.github/workflows/ci.yml` adding the `test-e2e` job.
2. Verify formatting and linting workspace-wide.
3. Commit changes to conventional format.

---

## Acceptance Criteria
- [x] `test-e2e` job successfully added to `.github/workflows/ci.yml`.
- [x] Playwright browsers install cleanly and run `pnpm test:e2e` with zero configuration friction.
- [x] Test reports are correctly uploaded as artifacts under GitHub actions environment on completion.
- [x] All linting, verification, and tests run successfully.
