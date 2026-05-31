# Spec 078 Design

## Decomposed Router Architecture

The new routes under `apps/api/src/routes/campaigns/` will be structured as follows:

```
apps/api/src/routes/campaigns/
├── index.ts        # Composes and exports campaignsApp, segmentsApp, unsubscribesApp
├── campaigns.ts    # Campaigns endpoints (campaignsApp)
├── segments.ts     # Segments endpoints (segmentsApp)
└── unsubscribes.ts # Unsubscribes endpoints (unsubscribesApp)
```

## Mounting and Types
The barrel entrypoint `index.ts` will re-export `campaignsApp`, `segmentsApp`, and `unsubscribesApp` to avoid modifying `apps/api/src/index.ts`. All sub-apps are mounted on the root `/` of their sub-routers to preserve the parent routing context prefix correctly.
