# Specification: Dependent Picklists & Field Value Matrix API - Verification

## 1. Terminal Pipelines

Ensure type safety, clean code patterns, and passing integration tests using the following command:

```bash
pnpm verify
```

## 2. Dynamic Integration Test Target

Run the dedicated test suite validating Picklist Dependencies under active RLS isolation:

```bash
pnpm --filter @crm/testing test run dependent-picklists
```
