# Spec 079 Verification Strategy

## Command Sequence

To verify the changes, execute:
```bash
pnpm run agent:check
```

This command will run the Biome checks, compilation gates, unit tests, and diagnostics to ensure the entire workspace is healthy.
- Build must compile successfully.
- All integration and unit tests under `packages/testing` must pass green.
- All E2E smoke tests must run successfully.
