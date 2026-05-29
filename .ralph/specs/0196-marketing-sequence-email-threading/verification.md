# Specification: Marketing Sequence Email Threading - Verification

To verify that the Marketing Sequence Email Threading API and RLS integration are fully implemented and function correctly, execute the following commands:

```bash
# 1. Typecheck the workspace to ensure strict compilation
pnpm typecheck

# 2. Run biome checking to ensure code linting/formatting pass cleanly
pnpm lint

# 3. Run the specific integration tests for task 0196
pnpm test packages/testing/src/marketing-sequence-threading.test.ts

# 4. Run full workspace verification checks
pnpm verify
```

These validation checks ensure the implementation is type-safe, meets the code formatting standards, and complies with RLS security policies.
