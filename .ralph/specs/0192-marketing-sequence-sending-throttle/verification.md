# Specification: Marketing Sequence Daily Sending Throttle Limit - Verification

## 1. Automated Verification Scripts
We will use the following verification commands to ensure that our implementation compiles, contains zero linting/formatting issues, and passes the integration tests:

```bash
# Typecheck workspace
pnpm typecheck

# Lint and check style using Biome
pnpm lint

# Execute unit and integration tests specifically for sequence throttle
npx vitest run packages/testing/src/marketing-sequence-throttle.test.ts

# Run the complete workspace verification
pnpm verify
```
