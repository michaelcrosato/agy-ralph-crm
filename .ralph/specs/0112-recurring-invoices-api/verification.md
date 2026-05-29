# Specification: Recurring Invoicing & Subscription Billing API - Verification

## Verification Tasks

Run monorepo checks at the workspace root directory:

```powershell
pnpm build
pnpm verify
pnpm test
```

## Expected Outcomes
- TypeScript builds the monorepo successfully.
- Biome check succeeds with zero warnings or errors.
- Vitest validates the pro-ration arithmetic, subscription persistence, automated invoice generation, and absolute RLS tenant isolation.
