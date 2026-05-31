# Spec 079 Design

## Decomposed Router Architecture

The new routes under `apps/api/src/routes/contacts/` will be structured as follows:

```
apps/api/src/routes/contacts/
├── index.ts        # Composes and exports contactsApp
├── crud.ts         # Handles GET /, GET /:id, POST /, PATCH /:id
├── operations.ts   # Handles GET /:id/duplicates, POST /:id/merge, POST /:id/enrich
└── hierarchy.ts    # Handles GET /:id/hierarchy
```

## Mounting and Types
The barrel entrypoint `index.ts` will compose and re-export `contactsApp` to avoid modifying `apps/api/src/index.ts`. All sub-apps are mounted on the root `/` of their sub-routers to preserve the parent routing context prefix correctly, and the primary base route mounts RLS and RBAC middleware once at the top level.
