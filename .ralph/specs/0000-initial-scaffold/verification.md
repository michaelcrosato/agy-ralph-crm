# Phase 0 Verification Guide (verification.md)

This specification outlines the concrete checks and validation routines that must pass to successfully exit **Phase 0: AI-Safe Foundation Setup**.

## Mandatory Checks

To verify that the workspace environment is correctly initialized and configured:

### 1. Monorepo Structural Validation

Verify all required directories, configuration packages, and routing trees are present.

```bash
# Check essential workspace package mappings
pnpm --filter web exec node -v
pnpm --filter api exec node -v
pnpm --filter @crm/core exec node -v
pnpm --filter @crm/db exec node -v
```

### 2. Workspace Linting & Code Hygiene

Ensure Biome configures linting and formatting rules perfectly across all packages.

```bash
# Run Biome validation routines globally
npx biome check .
```

### 3. Build & Compilation Verification

Ensure every workspace package compiles down to its target JavaScript bundle without type definitions mismatch.

```bash
# Compile and build monorepo packages via Turbo
pnpm build
```

### 4. Continuous Integration Pipeline Validation

Ensure that running `pnpm verify` completes successfully across all configured workspace targets.

```bash
# Run global verification script pipeline
pnpm verify
```

---
*Status: Initialized*
