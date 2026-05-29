# Specification: Opportunity Kanban Board Pipeline View API - Verification

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
- Vitest validates the Kanban aggregation mathematics, transition rules, stage validation gates, and active tenant RLS isolation boundaries.
