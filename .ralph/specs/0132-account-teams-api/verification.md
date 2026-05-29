# Spec 0132: Account Teams & Collaboration Roles Verification

## Execution Verification Sequence

Execute the following commands in the workspace root to ensure type safety, correct linting patterns, and pristine integration test results:

```bash
# 1. Execute specific integration & RLS test suite
pnpm test packages/testing/src/account-teams.test.ts

# 2. Run system-wide typechecks, biome lints, and all tests
pnpm verify
```

## Exit Criteria
- Output from Biome linter contains zero errors and zero warnings.
- Output from TypeScript compiler contains zero compilation errors.
- Both unit and integration test blocks execute and complete with exit code `0`.
