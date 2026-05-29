# Specification: Marketing Sequence Domain Throttling & Recipient Frequency Capping - Verification

## Verification Tasks

Run monorepo checks at the workspace root directory:

```bash
pnpm verify
pnpm test
```

## Expected Outcomes
- TypeScript builds the monorepo successfully with zero compiler issues.
- Biome check succeeds with zero warnings or errors.
- Vitest validates the recipient email domain extraction, domain sent counting, recipient sent counting, automated deferral schedule adjustments, system audit log generation, and strict tenant RLS isolation.
