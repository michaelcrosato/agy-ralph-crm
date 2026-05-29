# Spec 0127: Opportunity Contact Roles API Verification Plan

## Workspace Verification Commands

To verify that the feature has been successfully implemented, type-checked, formatted, and tested:

```bash
# 1. Verify TypeScript compiles and Biome lint checks pass
pnpm verify

# 2. Run the newly created integration test suite specifically
pnpm --filter @crm/testing test run src/opportunity-contact-roles.test.ts

# 3. Verify all tests in the workspace pass cleanly
pnpm test
```
