# Specification: Marketing Segment Sequence Enrollment API - Verification

To verify that the feature works perfectly, compiles cleanly, has no linter warnings/errors, and passes all tests:

```bash
# 1. Typecheck and Lint Check Workspace
pnpm verify

# 2. Run the newly created integration tests
pnpm --filter @crm/testing test -- marketing-segment-sequence-enrollment
```
