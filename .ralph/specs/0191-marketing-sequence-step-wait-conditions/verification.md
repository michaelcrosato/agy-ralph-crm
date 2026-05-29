# Specification: Marketing Sequence Step Wait Conditions - Verification

To verify that the implementation is robust, complete, and conforms to row-level security and typing rules, execute the following commands in the workspace root:

```bash
# 1. Run typescript verification
pnpm typecheck

# 2. Run lint check
pnpm lint

# 3. Run unit/integration tests
pnpm test

# 4. Verify all workspace pipelines via turbo
pnpm verify
```
