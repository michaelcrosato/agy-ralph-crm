# Specification: Outbox Pattern Webhooks & Dead Letter Queue (DLQ) - Verification

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
- Vitest validates:
  - That outbound webhooks are correctly enqueued in the `webhook_outbox` store during CRM operations.
  - That processing the outbox correctly executes the webhook dispatch.
  - That failing webhooks are retried with incremental attempts and exponential backoff timelines.
  - That webhooks failing 5 times are successfully purged from the outbox and transferred to the `webhook_dlq` store.
  - That strict active tenant RLS bounds prevent tenant data leakages across outbox queue and DLQ datasets.
