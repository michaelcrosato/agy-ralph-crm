# Phase 2: Primitive Record Core & Event Timelines - Verification

## Execution Gate Commands

To exit Phase 2 successfully, the following commands must execute cleanly with code 0:

```bash
# 1. Typecheck the entire project
pnpm build

# 2. Lint and format
npx biome check .

# 3. Execute unit & integration tests (including lead.test.ts)
pnpm test
```
