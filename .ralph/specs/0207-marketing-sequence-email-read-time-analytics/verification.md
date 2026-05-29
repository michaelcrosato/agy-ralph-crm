# Specification: Marketing Sequence Email Read Time Analytics & Scoring - Verification

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
- Vitest validates the read time event logging, classification arithmetic, step-level read-time analytics, and active tenant RLS isolation.
