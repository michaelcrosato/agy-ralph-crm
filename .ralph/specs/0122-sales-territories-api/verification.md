# Task 0122: Sales Territories & Account Routing Engine - Verification

To mark this task complete, run the following verification steps:

```bash
# Verify type safety and workspace compilation
pnpm typecheck

# Verify style and formatting requirements
pnpm lint

# Execute unit and integration tests including the new territory test suite
pnpm test
```

Verification is successful when `pnpm verify` (which runs the full Turborepo pipeline) finishes with exit code `0`.
