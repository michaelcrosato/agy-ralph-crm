# Specification: Support Ticket Comments & Replies Management Engine - Verification

## 1. Local Command Gate
To verify that the implementation is 100% complete and functionally correct, execute the following commands in the workspace root:

```bash
# 1. Typecheck validation
pnpm --filter @crm/db build
pnpm --filter @crm/core build
pnpm --filter @crm/testing build

# 2. Run target integration test suite
pnpm --filter @crm/testing test -- ticket-comments.test.ts

# 3. Global monorepo biome lint and type validation
pnpm verify
```

All validation gates must return exit code `0` cleanly.
