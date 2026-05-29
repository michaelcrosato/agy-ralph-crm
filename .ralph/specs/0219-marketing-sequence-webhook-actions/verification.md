# Specification: Marketing Sequence Webhook Actions - Verification

## Verification Tasks

Execute monorepo checks at the workspace root directory:

```powershell
pnpm verify
pnpm test
```

To run only the newly created test suite:
```powershell
pnpm --filter @crm/testing test marketing-sequence-webhook-actions
```

## Expected Outcomes
- TypeScript builds the monorepo successfully.
- Biome check succeeds with zero warnings or errors.
- Vitest validates the webhook sequence step creation, processing, outbox queuing, and absolute RLS tenant isolation.
