# Specification: Marketing Sequence Call Actions - Verification

## 1. Automated Verification Scripts
Verify the implementation using the vitest test suite specifically targeting Call sequence actions:

```bash
npx vitest run packages/testing/src/marketing-sequence-call-actions.test.ts
```

## 2. Monorepo-Wide Checks
Run the monorepo-wide code verification pipeline to ensure zero compiler or styling errors:

```bash
pnpm verify
```
