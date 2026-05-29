# Specification: Marketing Sequence Exit Triggers Engine - Verification

To verify that the feature works perfectly, we will run the entire suite of checks and unit/integration tests:

```bash
# Typecheck, lint, and run the newly added tests
pnpm verify
pnpm test packages/testing/src/marketing-sequence-exit-triggers.test.ts
```
