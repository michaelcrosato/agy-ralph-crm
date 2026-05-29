# Specification: Case Service Level Agreements (SLA) & Milestone Management Engine - Verification

## Standard Verification Commands

To verify that the Case SLA & Milestone Management Engine is complete and correct:

```bash
# 1. Verify TypeScript compiles cleanly with Biome lint checking
pnpm verify

# 2. Run the integration and RLS isolation tests specifically for SLAs
npx vitest run packages/testing/src/service-sla.test.ts

# 3. Run all workspace tests to ensure no regressions
pnpm test
```
