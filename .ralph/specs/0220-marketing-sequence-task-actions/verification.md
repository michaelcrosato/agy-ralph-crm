# Specification: Marketing Sequence Task Actions - Verification

## Verification Tasks

Execute monorepo checks at the workspace root directory:

```powershell
pnpm verify
pnpm test
```

To run only the newly created test suite:
```powershell
pnpm --filter @crm/testing test marketing-sequence-task-actions
```

## Expected Outcomes
- TypeScript compiles the entire monorepo successfully.
- Biome check succeeds with zero warnings or errors.
- Vitest validates the automated activity creation, variable personalization, RLS tenant isolation, and REST api endpoint.
