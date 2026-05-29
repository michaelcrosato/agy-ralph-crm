# Task 0165: Database Migration & Rollback Engine - Verification Plan

## Automated Script Gates

Execute the following verification gate to confirm formatting and compiler validation:

```bash
pnpm verify
```

## Integration Assertions

Validate using the newly introduced test suite:

```bash
npx vitest run packages/testing/src/migration-rollback.test.ts
```

This verifies:
1. `runStoreMigrations` applies pending migrations successfully.
2. `rollbackStoreMigrations` reverts applied migrations in reverse order.
3. RLS checks throw access control violations when tenant context mismatch exists.
