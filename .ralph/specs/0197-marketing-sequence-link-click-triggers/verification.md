# Specification: Marketing Sequence Link Click Triggers - Verification Plan

To verify Task 0197, execute the following commands in the workspace root:

```bash
# 1. Typecheck the workspace to assert compile-time correctness
pnpm typecheck

# 2. Lint/Format check via Biome
pnpm lint

# 3. Run the targeted integration test suite
pnpm --filter @crm/testing test src/marketing-sequence-link-triggers.test.ts

# 4. Run the global workspace verification pipeline
pnpm verify
```
