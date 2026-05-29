# Spec 0129: Sales Contracts & Account Renewals Verification

## Automated Test Execution

Execute the workspace verification pipelines using standard package scripts to validate correctness, lint formatting, and full type safety:

```bash
# Run unit and integration tests specifically targeting contracts
pnpm --filter @crm/testing test src/contracts.test.ts

# Run the complete workspace verification gate
pnpm verify
```

## Expected Output
* Vitest executes `contracts.test.ts` successfully, indicating 100% correct CRUD, RLS isolation boundary checks, renewal computations, and integration side-effects.
* Biome lints and formats all modified files cleanly.
* TypeScript compiler registers zero type mismatch warnings or errors.
