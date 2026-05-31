# Spec 077 Design

## Decomposed Router Architecture

The new routes under `apps/api/src/routes/accounts/` will be structured as follows:

```
apps/api/src/routes/accounts/
├── index.ts        # Composes and exports accountsApp
├── crud.ts         # Handles GET /, POST /, GET /:id, PATCH /:id
├── team.ts         # Handles GET /:id/team, POST /:id/team, DELETE /:id/team/:userId
├── hierarchy.ts    # Handles GET /:id/hierarchy, GET /:id/consolidated-pipeline
└── operations.ts   # Handles GET /:id/duplicates, POST /:id/merge, POST /:id/route, GET /:id/contracts
```

## Mounting and Types
The barrel entrypoint `index.ts` will re-export `accountsApp` to avoid modifying `apps/api/src/index.ts`. All sub-apps are mounted on the root `/` of their sub-routers to preserve the parent routing context prefix correctly.
