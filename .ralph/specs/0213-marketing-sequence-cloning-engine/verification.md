# Specification: Marketing Sequence Cloning & Template Copying Engine - Verification

To verify that the feature is fully implemented and works perfectly, the following commands must execute cleanly in the shell:

```bash
# 1. Check linting and formatting via Biome
pnpm lint

# 2. Run TypeScript compilation check
pnpm typecheck

# 3. Run the specific integration test suite
npx vitest run packages/testing/src/marketing-sequence-cloning.test.ts

# 4. Run full workspace verification
pnpm verify
```
