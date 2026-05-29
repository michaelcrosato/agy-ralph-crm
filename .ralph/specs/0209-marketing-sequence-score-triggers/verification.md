# Specification: Marketing Sequence Score-Based Automation Triggers - Verification

The implementation of Task 0209 is verified and marked complete only when the following suite of commands executes successfully and returns an exit code of `0`.

## 1. Biome Linter & Format Verification
Ensure biome checks and formats pass cleanly without warnings:
```bash
npx biome check --write .
```

## 2. Monorepo Build & TypeScript Typecheck Gate
Ensure workspace typechecks and builds without type compiler errors:
```bash
pnpm verify
```

## 3. Integration & RLS Isolation Tests
Execute the specific Vitest integration suite for score triggers:
```bash
pnpm test packages/testing/src/marketing-sequence-score-triggers.test.ts
```

## 4. Full Workspace Test Regression Suite
Execute the entire workspace test harness:
```bash
pnpm test
```
