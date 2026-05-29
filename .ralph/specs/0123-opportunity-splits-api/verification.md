# Task 0123: Opportunity Splits & Multi-Rep Commission Allocation - Verification

## Verification Scripts

Verify that the workspace compiles perfectly, all lints pass, and tests execute cleanly:

```bash
# Run Biome auto check/write formatting
npx biome check --write .

# Run global monorepo verify pipeline
pnpm verify

# Run Vitest test suites specifically highlighting opportunity splits
pnpm --filter @crm/testing test src/opportunity-splits.test.ts
```
