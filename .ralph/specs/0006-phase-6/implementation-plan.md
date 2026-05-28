# Phase 6: Performance Optimization & Testing Matrix - Implementation Plan

## Code Generation Steps

### Step 1: Benchmark Budget Setup
Create `bench/budget.json` configuring the limits for the AI agent context sizes.

### Step 2: High Scale Mock Seeder
Implement the seed data generator functions in `packages/testing/src/index.ts`. It builds bulk array structures representing real production nodes.

### Step 3: Verification Tests
Create `packages/testing/src/perf.test.ts` executing the seed generators and auditing performance footprints to ensure it complies with defined budgets.

### Step 4: Verify & Push
Run `pnpm verify` and `pnpm test` to ensure Phase 6 compiles and executes cleanly.
