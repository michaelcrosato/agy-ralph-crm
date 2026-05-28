# Specification: Lead Operations API & Multi-Tenant RLS Store - Verification

## Execution Gate Commands

To exit this specification successfully, the following commands must execute cleanly with exit code 0:

```bash
# 1. Typecheck and verify compilation
pnpm build

# 2. Check Biome lint/format compliance
npx biome check .

# 3. Run all test suites
pnpm test
```
