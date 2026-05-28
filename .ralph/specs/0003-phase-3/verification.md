# Phase 3: Metadata Customization Engine & Analytical Reporting - Verification

## Execution Gate Commands

To exit Phase 3 successfully, the following commands must execute cleanly with code 0:

```bash
# 1. Typecheck the entire project
pnpm build

# 2. Lint and format
npx biome check .

# 3. Execute unit & integration tests (including metadata.test.ts)
pnpm test
```
