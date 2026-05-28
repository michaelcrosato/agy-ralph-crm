# Specification: Opportunity Products, Products & Pricebooks API - Implementation Plan

## Step-by-Step Implementation Sequence

1. **Schema Layer updates (`packages/db/src/schema.ts`)**
   - Add new PostgreSQL table constructs for `products`, `pricebooks`, `pricebookEntries`, and `opportunityProducts`.
   - Ensure foreign key constraints map exactly and onDelete behaviors are set.

2. **In-Memory Store updates (`packages/db/src/index.ts`)**
   - Define typescript interfaces: `DBProduct`, `DBPricebook`, `DBPricebookEntry`, `DBOpportunityProduct`.
   - Extend `store` to initialize empty arrays for the four new datasets.
   - Add standard `dbStore` interfaces for `products`, `pricebooks`, `pricebookEntries`, and `opportunityProducts` supporting matching methods (`findMany`, `findOne`, `insert`, `update`, `delete` where applicable) enforcing strict `orgId` tenancy checks.

3. **Core Utility mapping (`packages/core/src/index.ts`)**
   - Add the pure rollup function `rollupOpportunityAmount` to calculate the aggregate amount from individual opportunity line item totals.

4. **REST Routes integration (`apps/api/src/index.ts`)**
   - Mount new HTTP Hono routes protected by `tenantAuth` middleware:
     - Product Catalog routes (`POST /api/products`, `GET /api/products`)
     - Pricebook catalog routes (`POST /api/pricebooks`, `GET /api/pricebooks`, `POST /api/pricebooks/entries`)
     - Opportunity Line Item routes (`POST /api/opportunities/:oppId/products`, `GET /api/opportunities/:oppId/products`, `PATCH /api/opportunities/:oppId/products/:lineItemId`, `DELETE /api/opportunities/:oppId/products/:lineItemId`)
   - Embed automatic amount rollup triggers on any mutation (POST, PATCH, DELETE) to update parent opportunity's overall `amount` in `dbStore`.

5. **Test Implementation (`packages/testing/src/opportunity-products-api.test.ts`)**
   - Create a dedicated Vitest test suite executing isolated cross-tenant scenarios.
   - Validate catalog creation, line item calculations, and multi-tenant RLS boundaries.

6. **Local verification**
   - Execute `pnpm verify` and `pnpm test` to assert flawless execution.
