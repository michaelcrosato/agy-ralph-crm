# Specification: Marketing Sequence Step Performance Analytics API - Verification

## Verification Tasks

Run checks at the workspace root directory:

```bash
pnpm build
pnpm verify
pnpm test
```

## Expected Outcomes
- All TypeScript packages compile cleanly.
- Biome check reports zero warnings or errors.
- Vitest validates email tracker generation, analytics calculations, and absolute RLS tenant isolation.
