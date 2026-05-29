# Specification: Marketing Sequence Bounce & Spam Protection / Handling - Verification

The following verification gates must pass cleanly before this task can be declared successfully completed:

## 1. Typecheck and Lint Check Gate
```bash
# Ensure Biome formatting and linting pass cleanly
pnpm verify
```

## 2. Integration and RLS Tests Gate
```bash
# Run the specific integration test suite to assert correct bounce/complaint handling and RLS tenant separation
pnpm --filter @crm/testing test marketing-sequence-bounce
```
