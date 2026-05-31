# Spec 080 Design

## Decomposed Router Architecture

The new routes under `apps/api/src/routes/contracts/` will be structured as follows:

```
apps/api/src/routes/contracts/
├── index.ts        # Composes and exports contractsApp, documentsApp, invoicesApp, subscriptionsApp
├── contracts.ts    # Contracts endpoints (contractsApp)
├── documents.ts    # Documents endpoints (documentsApp)
├── invoices.ts     # Invoices endpoints (invoicesApp)
└── subscriptions.ts # Subscriptions endpoints (subscriptionsApp)
```

## Mounting and Types
The barrel entrypoint `index.ts` will re-export `contractsApp`, `documentsApp`, `invoicesApp`, and `subscriptionsApp` to avoid modifying `apps/api/src/index.ts`. All sub-apps are mounted on the root `/` of their sub-routers to preserve the parent routing context prefix correctly.
