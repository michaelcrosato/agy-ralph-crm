# Spec 082 Design

## Decomposed Router Architecture

The new routes under `apps/api/src/routes/opportunities/products/` will be structured as follows:

```
apps/api/src/routes/opportunities/products/
├── index.ts              # Composes and exports productsApp and opportunitiesProductsApp
├── products.ts           # Products CRUD endpoints
├── line-items.ts         # Opportunity line items (GET/POST/PATCH/DELETE)
├── quotes.ts             # Quoting & CPQ (GET/POST quotes)
└── schedules.ts          # Payment schedules (GET/POST/DELETE/generate schedules)
```

## Mounting and Types
The barrel entrypoint `index.ts` will re-export `productsApp` and `opportunitiesProductsApp` to avoid modifying any parent route mounts. All sub-apps are mounted on the root `/` of their sub-routers to preserve the parent routing context prefix correctly.
