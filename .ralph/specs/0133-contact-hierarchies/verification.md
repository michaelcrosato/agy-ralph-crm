# Spec 0133: Contact Hierarchies & Organizational Org Charts Verification

To verify that the feature meets the definition of done, execute the verification suite:

```bash
# Compile and check types across all packages
pnpm typecheck

# Lint workspace files cleanly via Biome
pnpm lint

# Execute integration tests
pnpm test packages/testing/src/contact-hierarchy.test.ts

# Run the complete workspace verification command
pnpm verify
```
