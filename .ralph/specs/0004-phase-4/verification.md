# Phase 4: Workflow Engine & External Interface Integration - Verification

## Execution Gate Commands

To exit Phase 4 successfully, the following commands must execute cleanly with code 0:

```bash
# 1. Typecheck the entire project
pnpm build

# 2. Lint and format
npx biome check .

# 3. Execute unit & integration tests (including workflow.test.ts)
pnpm test
```
