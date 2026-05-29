# Specification: Support Ticket Routing & Assignment Rules Engine - Verification

To verify that the Support Ticket Routing & Assignment Rules Engine works correctly, the following commands must run successfully:

```bash
# Compile and build the entire workspace
pnpm build

# Run Biome checks for formatting and linting
pnpm lint

# Execute the specific integration test suite
pnpm test packages/testing/src/ticket-routing.test.ts

# Run the full workspace verification pipeline
pnpm verify
```
