# Specification: Public Web-to-Lead Capture API - Verification

## 1. Automated Test Suite Execution
Execute the targeted vitest suite to verify full endpoint functionality, validation rules, active lead assignment, RLS isolation, audit logging, and webhook dispatching:

```bash
pnpm --filter @crm/testing test run web-to-lead.test.ts
```

## 2. Workspace Verification
Verify that the workspace builds, compiles without typescript errors, and matches the formatting rules:

```bash
pnpm verify
```

## 3. Standard Definition of Done
Ensure:
- 100% test coverage for the Web-to-Lead public endpoint.
- Correct RLS context wrapping using `withTenant`.
- Seamless integration with Lead Assignment Rules and round-robin scheduling.
- Zero typescript errors or warnings across all workspace packages.
