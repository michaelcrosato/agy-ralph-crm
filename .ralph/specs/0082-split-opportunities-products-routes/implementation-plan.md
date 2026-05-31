# Spec 082 Implementation Plan

## Steps

1. **Extract Products Router**: Extract standard products catalog endpoints to `apps/api/src/routes/opportunities/products/products.ts`.
2. **Extract Line Items Router**: Extract opportunity line items endpoints to `apps/api/src/routes/opportunities/products/line-items.ts`.
3. **Extract Quotes Router**: Extract quoting CPQ endpoints to `apps/api/src/routes/opportunities/products/quotes.ts`.
4. **Extract Schedules Router**: Extract payment schedules endpoints to `apps/api/src/routes/opportunities/products/schedules.ts`.
5. **Create Barrel index**: Export `productsApp` and `opportunitiesProductsApp` inside `apps/api/src/routes/opportunities/products/index.ts`.
6. **Remove Monolith**: Safely remove monolithic `apps/api/src/routes/opportunities/products.ts`.
7. **Verify Monorepo**: Run linter, compiler, tests, and preflights using `pnpm run agent:check`.
