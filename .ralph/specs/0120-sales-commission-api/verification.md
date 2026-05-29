# Specification: Sales Commission Calculation & Attainment Tracking - Verification

Verify the implementation of spec 0120 by running the downstream tools in sequence:

```bash
# 1. Verify and run Biome lint checks
pnpm lint

# 2. Run commission integration tests
pnpm test packages/testing/src/commissions.test.ts

# 3. Verify workspace verification pipeline runs cleanly
pnpm verify
```
