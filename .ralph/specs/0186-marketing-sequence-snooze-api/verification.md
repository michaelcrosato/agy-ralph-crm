# Specification: Marketing Sequence Member Snooze & Resume Engine - Verification

## 1. Local Verification Protocol

To verify that the implementation is 100% complete, compiles cleanly, has zero lint/formatting issues, and passes the entire integration suite, execute the following commands in the workspace root:

```bash
# 1. Automatic Code Formatting & Checking
npx biome check --write .

# 2. Compile and Verify TypeScript safety
pnpm typecheck

# 3. Run Snooze Integration & RLS Test Suite
pnpm --filter @crm/testing test marketing-sequence-snooze.test.ts

# 4. Verify Entire Workspace Pipeline
pnpm verify
```

The task is deemed complete when all integration tests pass cleanly and `pnpm verify` completes with exit code `0`.
