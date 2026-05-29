# Specification: Marketing Sequence Folders & Tag Categorization - Verification

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
- Vitest validates the color validator, recursive parent detection, RLS tenant isolation on sequence folders, sequence tags, mapping logic, Hono endpoints, and correct auditing.
