# Specification: Custom Validation Rules Engine API - Verification

## 1. Terminal Pipelines

Ensure type safety, clean code patterns, and passing integration tests using the following command:

```bash
pnpm verify
```

## 2. Dynamic Integration Test Target

Run the dedicated test suite validating Custom Validation Rules under active RLS isolation:

```bash
pnpm --filter @crm/testing test run custom-validation-rules
```
