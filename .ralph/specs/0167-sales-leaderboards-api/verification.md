# Task 0167: Sales Leaderboards & Quota Attainment API - Verification

## Step 1: TypeScript Compilation Check
Verify the monorepo workspace typechecks successfully:
```bash
pnpm typecheck
```

## Step 2: Code Quality & Biome Linter Validation
Ensure the linter is fully satisfied:
```bash
pnpm lint
```

## Step 3: Sales Leaderboard Integration and RLS Tests
Run the specific integration tests for the sales leaderboard engine:
```bash
pnpm test packages/testing/src/leaderboards.test.ts
```

## Step 4: Workspace Verification Pipeline Gate
Confirm all systems compile and verify cleanly across packages:
```bash
pnpm verify
```
