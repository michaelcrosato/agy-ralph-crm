# Specification: Marketing Sequence Dynamic Branching & Event Paths - Verification

## Verification Commands

Execute the following verification gate commands to ensure correctness:

```bash
# 1. Standard compilation check
pnpm typecheck

# 2. Biome linting and formatting
pnpm lint

# 3. Targeted test suite run
pnpm test packages/testing/src/marketing-sequence-branching.test.ts

# 4. Monorepo-wide verification script
pnpm verify
```
