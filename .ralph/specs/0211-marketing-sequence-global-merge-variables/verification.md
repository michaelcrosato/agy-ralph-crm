# Specification: Marketing Sequence Global Merge Variables - Verification

The implementation of Task 0211 is verified and marked complete only when the following suite of commands executes successfully and returns an exit code of `0`.

## 1. Local Verification Suite

Run the full workspace validation using `pnpm verify`:
```bash
pnpm verify
```

## 2. Dynamic Integration Tests

Run only the new integration test suite to verify correctness:
```bash
pnpm test packages/testing/src/marketing-sequence-global-variables.test.ts
```

This verifies:
1. Dynamic CRUD execution for tenant-scoped variables.
2. Tenant RLS boundaries.
3. Template personalization engine resolving global tokens correctly.
