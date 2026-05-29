# Specification: Campaign Unsubscribe & Recipient Opt-Out API - Verification

## 1. Local Pipeline Verification

Ensure that the typecheck, lint, and test validation gates pass cleanly for the entire workspace.

```bash
# 1. Run workspace verify task
pnpm verify

# 2. Run unit and integration tests (including the new campaign-unsubscribe test)
pnpm test
```

## 2. Specific Verification Target

Run the newly created integration test file directly:

```bash
pnpm --filter @crm/testing test -- src/campaign-unsubscribe.test.ts
```

All tests must pass successfully, and Biome lint checks must remain 100% clean.
