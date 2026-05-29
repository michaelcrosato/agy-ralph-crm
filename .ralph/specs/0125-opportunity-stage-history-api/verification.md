# Spec 0125: Opportunity Stage History & Velocity Tracking API Verification

## Commands to Validate the Feature

Execute the following commands from the root directory to guarantee type-safety, code quality, and behavioral correctness:

```bash
# 1. Typecheck the workspace to ensure no compilation issues
pnpm typecheck

# 2. Lint and format code with Biome
pnpm lint

# 3. Run the specific integration test suite to verify RLS boundaries and API correctness
pnpm --filter @crm/testing test run src/opportunity-stage-history.test.ts

# 4. Run the global workspace verification pipeline
pnpm verify
```
