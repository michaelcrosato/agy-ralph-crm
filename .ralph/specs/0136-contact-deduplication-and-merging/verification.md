# Spec 0136: Contact De-duplication and Merging API Verification

## Verification Commands

To verify that the feature is fully implemented, error-free, type-safe, and secure under row-level security:

```bash
# Compile and check all TypeScript code in the workspace
pnpm verify

# Run the complete test suite to assert the implementation and RLS isolation boundaries
pnpm test
```
