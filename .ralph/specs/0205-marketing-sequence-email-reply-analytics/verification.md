# Specification: Marketing Sequence Email Reply Analytics - Verification

## Verification Tasks

Run monorepo checks at the workspace root directory:

```powershell
pnpm build
pnpm verify
pnpm test
```

## Expected Outcomes
- TypeScript builds the monorepo successfully.
- Biome check succeeds with zero warnings or errors.
- Vitest validates the reply event logging, sentiment analysis parsing logic, step-level rate arithmetic, and active tenant RLS isolation.
