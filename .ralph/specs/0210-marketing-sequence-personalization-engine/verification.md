# Specification: Marketing Sequence Personalization Engine - Verification

To declare this specification task fully completed and production-ready, the following verification commands must run and return exit code `0` cleanly:

## 1. Typecheck and Lint Check
Ensure the monorepo has zero TypeScript compiler or Biome formatting/linter errors:
```bash
pnpm verify
```

## 2. Dynamic Personalization Engine Tests
Run only the specific new test suite to verify correct logic:
```bash
pnpm test packages/testing/src/marketing-sequence-personalization.test.ts
```

## 3. Global Regression Suite
Verify that no existing marketing sequences or lead conversion flows are broken:
```bash
pnpm test
```
