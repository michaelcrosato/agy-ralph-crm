# Spec 0141: Sales Path Guidance API Verification

## Automated Verification Steps
Execute the following verification sequence in your shell to ensure the Sales Path Guidance API implementation compiles, lints, and passes all RLS and integration tests.

```bash
# 1. Typecheck the workspace
pnpm typecheck

# 2. Run lint checks
pnpm lint

# 3. Execute the new Stage Guidance integration test suite
pnpm --filter @crm/testing test src/stage-guidance.test.ts

# 4. Verify all tests in the workspace pass successfully
pnpm test

# 5. Run the global workspace verification pipeline
pnpm verify
```
