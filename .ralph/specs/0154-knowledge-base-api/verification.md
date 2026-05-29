# Specification: Support Knowledge Base (Articles & Categories) Management Engine - Verification

## 1. Local Verification Suite
To confirm the feature is fully complete, typechecks cleanly, formats correctly, and passes all RLS integration tests, execute the following commands in the workspace root:

```bash
# Formatter & Linter check
npx biome check --write .

# Build step verification
pnpm build

# Target test run
pnpm --filter @crm/testing test run src/service-kb.test.ts

# Global verification gate
pnpm verify
```
