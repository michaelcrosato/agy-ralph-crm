# Specification: Document Templates & Mail Merge Engine - Verification

## Verification Tasks

Run monorepo checks at the workspace root directory:

```powershell
pnpm build
pnpm verify
pnpm test
```

## Expected Outcomes
- TypeScript builds successfully.
- Biome check succeeds with zero errors.
- Vitest validates template replacement logic, deep Custom JSONB values, and absolute RLS tenant boundaries.
