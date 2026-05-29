# Spec 0128: Campaign Influence API Verification Plan

## Automated Verification Steps
To verify that this feature is fully built and correct, the following steps must be run:

```bash
# 1. Typecheck the entire workspace
pnpm typecheck

# 2. Run lint check
pnpm lint

# 3. Run the specific campaign-influence test suite
pnpm test packages/testing/src/campaign-influence.test.ts

# 4. Verify the entire workspace builds and tests pass
pnpm verify
```

All verification gates must return exit code `0`.
