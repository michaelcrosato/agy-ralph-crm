# Spec 082: Split opportunities products routes (620 → ≤400 lines)

## Brief

The monolithic Hono opportunity products router at `apps/api/src/routes/opportunities/products.ts` has grown to 620 lines, exceeding our strict 400-line budget limit. It contains endpoints for products catalog CRUD, opportunity line items, quoting CPQ, and payment schedules in a single file.

This specification describes the architectural decomposition of this monolith into isolated, single-responsibility route modules under a dedicated `apps/api/src/routes/opportunities/products/` directory. By splitting the endpoints, we enhance maintainability, reduce token overhead, and conform fully to the file line limits while preserving RPC type schemas.
