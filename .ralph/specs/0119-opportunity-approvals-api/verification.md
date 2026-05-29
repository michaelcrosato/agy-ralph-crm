# Specification: Multi-Stage Opportunity Approval Processes - Verification

Verify the implementation of spec 0119 by running the downstream tools in sequence:

```bash
# 1. Verify and run Biome lint checks
pnpm lint

# 2. Run opportunity approval integration tests
pnpm test packages/testing/src/opportunity-approvals.test.ts

# 3. Verify workspace verification pipeline runs cleanly
pnpm verify
```
