# Specification: Marketing Sequence Step Deletion & Cascading Shift Engine - Verification

To verify that the Marketing Sequence Step Deletion & Cascading Shift Engine complies with all structural and functional constraints, execute the following commands in the host workspace:

```bash
# 1. Typecheck the workspace to ensure full TypeScript compilation
pnpm typecheck

# 2. Run Biome formatting and lint check verification
pnpm lint

# 3. Run the specific integration test suite for marketing sequence step deletion
pnpm --filter @crm/testing test marketing-sequence-step-deletion

# 4. Run global project verification
pnpm verify
```
