# Specification: Marketing Sequence Email Reply Triggers - Verification

## 1. Local Verification Commands
To verify the correctness of the implementation, run the following commands sequentially:

```bash
# Clean, typecheck, and verify format/lint checks
pnpm verify

# Run the integration tests specifically for reply triggers
npx vitest run packages/testing/src/marketing-sequence-reply-triggers.test.ts
```

## 2. Expected Output
- All TypeScript compiler assertions pass without errors.
- Biome code format check succeeds cleanly.
- The unit and integration tests under `marketing-sequence-reply-triggers.test.ts` pass with 100% success.
