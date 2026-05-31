# Spec 082 Requirements

## Functional Requirements
- **Route Preservation**: Decompose all existing endpoints exactly, preserving parameters, validation guards, and authorization middleware.
- **RPC Consistency**: Ensure Hono's RPC type inference (`hc<AppType>`) remains perfectly intact, resolving compile-time client SDK bindings without any modification in consuming front-end pages.
- **Products Catalog CRUD**: Retain standard products insertions (`productsApp.post("/", ...)`) and lookups (`productsApp.get("/", ...)`).
- **Opportunity Line Items**: Retain opportunity products CRUD, line items rollups calculations (`rollupOpportunityAmount`), and database updates.
- **Quoting CPQ**: Retain custom discount CPQ price calculations (`calculateCPQPrice`), standard proposal compiling, merged documents insertions (`dbStore.mergedDocuments.insert`), and auditing.
- **Payment Schedules**: Retain schedule validators (`validateOpportunityProductSchedule`), dynamic schedules generation (`generateStraightLineSchedules`), audit logging, and webhook dispatchers.

## Non-Functional Requirements
- **File line limits**: Every decomposed route file must remain strictly under 400 lines. The orchestrating `index.ts` must remain under 100 lines.
- **Zero regressions**: All existing unit and integration tests must run and complete successfully with zero errors.
- **Biome compliance**: Code formatting, rules, and lints must pass cleanly.
