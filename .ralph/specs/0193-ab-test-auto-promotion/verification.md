# Specification: Marketing Sequence A/B Test Winner Auto-Promotion Engine - Verification

## 1. Automated Verification Scripts
We will use the following verification commands to ensure that our implementation compiles, contains zero linting/formatting issues, and passes the integration tests:

```bash
# Typecheck workspace
pnpm typecheck

# Lint and check style using Biome
pnpm lint

# Execute unit and integration tests specifically for A/B auto-promotion
npx vitest run packages/testing/src/marketing-sequence-ab-promotion.test.ts

# Run the complete workspace verification
pnpm verify
```
