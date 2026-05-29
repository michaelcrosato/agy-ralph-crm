# Task 0121: Lead Assignment Rules & Auto-Routing Engine - Verification

## Target Verification Command Sequence

Ensure all commands succeed with exit code `0` before marking this task complete:

```bash
# 1. Typecheck the entire monorepo workspace
pnpm typecheck

# 2. Lint and format all workspace files
pnpm lint

# 3. Run the complete integration test suite including the new lead-assignment suite
pnpm test

# 4. Run the full verification pipeline
pnpm verify
```
