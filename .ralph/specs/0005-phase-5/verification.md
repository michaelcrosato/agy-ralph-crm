# Phase 5: Managed First-Party Core Extensions - Verification

## Execution Gate Commands

To exit Phase 5 successfully, the following commands must execute cleanly with code 0:

```bash
# 1. Typecheck the entire project
pnpm build

# 2. Lint and format
npx biome check .

# 3. Execute unit & integration tests (including extension.test.ts)
pnpm test
```
