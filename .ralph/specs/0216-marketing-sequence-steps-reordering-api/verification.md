# Specification: Marketing Sequence Steps Reordering API - Verification

To verify that the Marketing Sequence Steps Reordering API complies with all structural and functional constraints, execute the following commands in the host workspace:

```bash
# 1. Typecheck the workspace to ensure full TypeScript compilation
pnpm typecheck

# 2. Run Biome formatting and lint check verification
pnpm lint

# 3. Run the specific integration test suite for marketing sequence steps reordering
pnpm --filter @crm/testing test marketing-sequence-reorder

# 4. Run global project verification
pnpm verify
```
