# Spec 0134: Lead Scoring Rules Verification Plan

## Automated Verification Steps
Verify the workspace compiles and lint checks pass cleanly using:

```bash
pnpm verify
```

Verify that all unit and integration test suites run and pass cleanly using:

```bash
pnpm test
```

## Specific Test Target
To run only the newly created test suite for Lead Scoring Rules:

```bash
pnpm --filter @crm/testing test src/lead-scoring.test.ts
```
