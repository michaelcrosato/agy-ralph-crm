# Specification: Opportunity Product Schedules API - Verification

## Verification Execution Commands
Execute the following continuous integration validation command array:

```bash
# 1. Verify Biome formatting and linting
pnpm lint

# 2. Verify TypeScript type safety compiles cleanly
pnpm typecheck

# 3. Run unit and integration tests including RLS multi-tenancy verification
pnpm test

# 4. Global workspace verification check
pnpm verify
```
