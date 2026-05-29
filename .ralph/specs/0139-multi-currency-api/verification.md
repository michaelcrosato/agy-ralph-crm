# Spec 0139: Multi-Currency & Exchange Rates Engine Verification

## Automated Gates

Execute the following commands to compile the monorepo packages, run standard lints, and execute integration test suites:

```bash
# 1. Typecheck Workspace
pnpm typecheck

# 2. Lint and Format Check
pnpm lint

# 3. Execute Integration Test Suite
pnpm test --filter @crm/testing
```

All validation gates must return exit code `0` to certify this feature as complete.
