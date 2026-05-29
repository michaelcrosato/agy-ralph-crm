# Specification: Marketing Sequence Dynamic Sender Assignment - Verification

## Verification Tasks

Run monorepo checks at the workspace root directory:

```bash
pnpm verify
pnpm test
```

## Expected Outcomes
- TypeScript builds the monorepo successfully with zero compiler issues.
- Biome check succeeds with zero warnings or errors.
- Vitest validates:
  - Sequence creation/update with correct `senderType` and `senderUserId`.
  - Fallback logic when `"owner"` has no owner or is system sender.
  - Correct resolution of `creatorId` during `executePendingSequenceSteps` loop execution.
  - Tenant RLS isolation preventing orgs from assigning members belonging to other organizations.
