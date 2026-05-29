# Specification: Marketing Sequences & Drip Journeys API - Verification

## 1. Local Pipeline Verification
Execute full workspace check routines at the workspace root directory:

```bash
pnpm verify
pnpm test
```

## 2. Target Test Execution
Run the marketing sequences integration test suite specifically:

```bash
pnpm --filter @crm/testing test -- src/marketing-sequences.test.ts
```

All 4 integration scenarios must pass cleanly, and the Biome linter check must output zero errors or formatting deviations.
