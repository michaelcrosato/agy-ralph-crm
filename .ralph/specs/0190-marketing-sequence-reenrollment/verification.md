# Specification: Marketing Sequence Campaign Automated Re-Enrollment & Frequency Capping Controls - Verification

To verify that the feature works perfectly and matches the definition of done, execute the following commands in the workspace root:

## 1. Typecheck and Compile
```bash
pnpm typecheck
```

## 2. Formatting and Lint Checks
```bash
pnpm lint
```

## 3. Run Targeted Integration & RLS Tests
```bash
pnpm test packages/testing/src/marketing-sequence-reenrollment.test.ts
```

## 4. Run Complete Verification Gate
```bash
pnpm verify
```
Confirm the pipeline finishes with exit code `0`.
