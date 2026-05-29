# Specification: Customer Satisfaction (CSAT) & NPS Survey Engine - Verification

The definition of done is achieved when the following verification steps pass cleanly with exit code 0.

## 1. Automated Test Suite Execution
Execute the Vitest integration suite explicitly validating the new surveys functionality:
```bash
pnpm --filter @crm/testing test src/surveys.test.ts
```

## 2. Formatting & Code Style Enforcement
Ensure Biome format rules are fully satisfied:
```bash
npx biome check --write .
```

## 3. Production Monorepo Pipeline Verification
Validate that the entire workspace builds and compiles successfully:
```bash
pnpm verify
```
