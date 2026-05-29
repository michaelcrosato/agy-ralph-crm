# Spec 0124: Campaigns & Campaign Members API Verification

## Test Scripts Execution
To close out Task 0124, the suite of commands below must be executed successfully with a clean terminal response (`exit 0`):

```bash
# 1. Ensure Biome code formatting is completely clean and complies with workspace rules
pnpm lint

# 2. Verify all TypeScript types resolve properly across packages and applications
pnpm typecheck

# 3. Run the specific campaigns unit & RLS integration test suite
pnpm --filter @crm/testing test src/campaigns.test.ts

# 4. Run the entire workspace verification suite
pnpm verify
```
