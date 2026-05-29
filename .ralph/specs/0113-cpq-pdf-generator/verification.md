# Specification: CPQ PDF Generator - Verification

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
- Vitest validates the tier-based discount arithmetic, custom discount overrides, document/quote templates compilation, and absolute RLS tenant isolation.
