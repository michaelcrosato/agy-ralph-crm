# Specification: Marketing Sequence Pause & Resume API - Verification

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
- Vitest validates the sequence pause and resume functionality, status transitions, execution bypass in the background runner, and strict RLS isolation.
